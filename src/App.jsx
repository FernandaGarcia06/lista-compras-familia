import logoCarrinho from "./assets/logo-carrinho.png";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from "firebase/firestore";
import {
  Check,
  ChevronRight,
  Copy,
  DoorOpen,
  EllipsisVertical,
  Info,
  ListChecks,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Search,
  Share,
  Sparkle,
  SquareCheck,
  Trash2,
  Undo2,
  UserMinus,
  X,
} from "lucide-react";
import { db, auth } from "./firebase";
import Login from "./Login";
import "./App.css";

/* ------------------------------------------------------------------ */
/* Constantes e funções auxiliares (ficam fora do componente para não  */
/* serem recriadas a cada renderização)                                */
/* ------------------------------------------------------------------ */

const UNIDADES = [
  "unidade(s)",
  "unidade(s)/kg",
  "pacote(s)",
  "caixa(s)",
  "kg",
  "grama(s)",
  "litro(s)",
  "garrafa(s)",
];

const MERCADOS = ["Tenda", "Savegnago", "Atacadão"];

const PRODUTO_VAZIO = {
  nome: "",
  quantidade: 1,
  unidade: "unidade(s)",
  mercados: [],
};

// O Firestore aceita até 500 operações por lote; usamos uma margem.
const TAMANHO_LOTE = 450;

function rotuloUnidade(valor) {
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

function normalizarUnidade(valor) {
  const antigas = {
    unidades: "unidade(s)",
    pacotes: "pacote(s)",
    caixas: "caixa(s)",
    gramas: "grama(s)",
    litros: "litro(s)",
    garrafas: "garrafa(s)",
  };
  return antigas[valor] || valor || "unidade(s)";
}

// Ignora acentos, maiúsculas e espaços nas pontas: "Açúcar" === "acucar"
function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function mesmoNome(a, b) {
  return normalizarTexto(a) === normalizarTexto(b);
}

function gerarCodigoCompartilhamento() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return codigo;
}

function temPreco(preco) {
  return (
    preco !== "" &&
    preco !== null &&
    preco !== undefined &&
    Number.isFinite(Number(preco))
  );
}

function obterMercados(produto) {
  if (Array.isArray(produto.mercados) && produto.mercados.length) {
    return produto.mercados;
  }
  if (produto.local) return [{ local: produto.local, preco: produto.preco }];
  return [];
}

function obterMercadosComPreco(produto) {
  return obterMercados(produto).filter((m) => m.local && temPreco(m.preco));
}

function formatarPreco(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Grava várias operações de uma vez (mais rápido e "tudo ou nada" por lote)
async function executarEmLotes(itens, aplicar) {
  for (let i = 0; i < itens.length; i += TAMANHO_LOTE) {
    const lote = writeBatch(db);
    itens.slice(i, i + TAMANHO_LOTE).forEach((item) => aplicar(lote, item));
    await lote.commit();
  }
}

// Lê uma lista; devolve null se ela não existir ou se o acesso foi removido
async function lerLista(id) {
  try {
    const snapshot = await getDoc(doc(db, "listas", id));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (erro) {
    if (erro.code === "permission-denied") return null;
    throw erro;
  }
}

function textoQuantidade(produto) {
  return `${produto.quantidade} ${normalizarUnidade(produto.unidade)}`;
}

// Abreviação da unidade para o preço unitário: "R$ 6,00/kg"
const ABREVIACOES_UNIDADE = {
  "unidade(s)": "un",
  "unidade(s)/kg": "kg",
  "pacote(s)": "pct",
  "caixa(s)": "cx",
  kg: "kg",
  "grama(s)": "g",
  "litro(s)": "L",
  "garrafa(s)": "gf",
};

function abreviarUnidade(unidade) {
  return ABREVIACOES_UNIDADE[normalizarUnidade(unidade)] || "un";
}

/* ------------------------------------------------------------------ */
/* Comparação de mercados na lista (celular e computador)              */
/* ------------------------------------------------------------------ */

function ComparacaoMercados({ produto }) {
  const mercadosComPreco = obterMercadosComPreco(produto);
  const menorPreco = mercadosComPreco.length
    ? Math.min(...mercadosComPreco.map((m) => Number(m.preco)))
    : 0;
  const unidade = abreviarUnidade(produto.unidade);
  // Com quantidade 1 o preço unitário é igual ao total, então não repete
  const mostrarUnitario = Number(produto.quantidade) !== 1;

  // Do mais barato ao mais caro; mercados sem preço no fim
  const mercados = obterMercados(produto)
    .filter((m) => m.local)
    .sort((a, b) => {
      const pa = temPreco(a.preco) ? Number(a.preco) : Infinity;
      const pb = temPreco(b.preco) ? Number(b.preco) : Infinity;
      return pa - pb;
    });

  if (!mercados.length) return null;

  return (
    <div className="comparacao">
      {mercados.map((m, i) => {
        const comPreco = temPreco(m.preco);
        const maisBarato =
          comPreco && mercadosComPreco.length > 1 && Number(m.preco) === menorPreco;
        return (
          <div
            key={`${m.local}-${i}`}
            className={`comparacao-linha ${maisBarato ? "comparacao-barato" : ""}`}
          >
            <span className="comparacao-nome">
              <span className="comparacao-mercado">{m.local}</span>
              {maisBarato && <em className="selo-barato">mais barato</em>}
            </span>
            {comPreco && (
              <span className="comparacao-precos">
                <strong>{formatarPreco(Number(m.preco) * Number(produto.quantidade))}</strong>
                {mostrarUnitario && (
                  <small>
                    {formatarPreco(m.preco)}/{unidade}
                  </small>
                )}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resumo do produto na lista (celular): quantidade e mercados         */
/* ------------------------------------------------------------------ */

function ResumoProduto({ produto }) {
  return (
    <>
      <p className="produto-resumo">{textoQuantidade(produto)}</p>
      <ComparacaoMercados produto={produto} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Colunas "Mercados" e "Total" da lista no computador                 */
/* ------------------------------------------------------------------ */

function ColunasMercado({ produto }) {
  const temMercados = obterMercados(produto).some((m) => m.local);
  const mercadosComPreco = obterMercadosComPreco(produto);

  let total = <span className="coluna-vazia">—</span>;
  if (mercadosComPreco.length) {
    const menorPreco = Math.min(...mercadosComPreco.map((m) => Number(m.preco)));
    total = (
      <strong className="preco-verde">
        {formatarPreco(menorPreco * Number(produto.quantidade))}
      </strong>
    );
  }

  return (
    <>
      <span className="coluna-pc coluna-mercado">
        {temMercados ? (
          <ComparacaoMercados produto={produto} />
        ) : (
          <span className="coluna-vazia">—</span>
        )}
      </span>
      <span className="coluna-pc coluna-total">{total}</span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tabela de mercados (detalhes do produto)                            */
/* ------------------------------------------------------------------ */

function TabelaMercados({ produto }) {
  const mercados = obterMercados(produto).filter((m) => m.local);
  const mercadosComPreco = obterMercadosComPreco(produto);
  const menorPreco = mercadosComPreco.length
    ? Math.min(...mercadosComPreco.map((m) => Number(m.preco)))
    : 0;

  if (!mercados.length) {
    return <p className="sem-mercados">Nenhum mercado informado para este produto.</p>;
  }

  return (
    <div className="tabela-mercados">
      <div className="tabela-linha tabela-cabecalho">
        <span>Mercado</span>
        <span>Total</span>
        <span>Unitário</span>
      </div>
      {mercados.map((m, i) => {
        const comPreco = temPreco(m.preco);
        const maisBarato =
          comPreco && mercadosComPreco.length > 1 && Number(m.preco) === menorPreco;
        return (
          <div key={`${m.local}-${i}`} className="tabela-linha">
            <span className="tabela-mercado">
              {m.local}
              {maisBarato && <em className="selo-barato">mais barato</em>}
            </span>
            <strong className={maisBarato ? "preco-verde" : ""}>
              {comPreco ? formatarPreco(Number(m.preco) * Number(produto.quantidade)) : "—"}
            </strong>
            <span className="tabela-unitario">{comPreco ? formatarPreco(m.preco) : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  // Autenticação
  const [usuario, setUsuario] = useState(null);
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [reenviando, setReenviando] = useState(false);
  const [conferindoVerificacao, setConferindoVerificacao] = useState(false);
  const [mensagemVerificacao, setMensagemVerificacao] = useState(null);

  // Lista
  const [listaId, setListaId] = useState(null);
  const [codigoCompartilhamento, setCodigoCompartilhamento] = useState("");
  const [donoIdLista, setDonoIdLista] = useState(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [membrosLista, setMembrosLista] = useState([]);
  const [buscaLista, setBuscaLista] = useState("");

  // Produto (detalhes, formulário e exclusão)
  const [idProdutoAberto, setIdProdutoAberto] = useState(null);
  const [idProdutoEditando, setIdProdutoEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [novoProduto, setNovoProduto] = useState(PRODUTO_VAZIO);
  const [compararPrecos, setCompararPrecos] = useState(false);
  const [erroFormulario, setErroFormulario] = useState("");
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState(null);

  // Seleção múltipla
  const [modoSelecao, setModoSelecao] = useState(false);
  const [produtosSelecionados, setProdutosSelecionados] = useState([]);
  const [mostrarConfirmarExclusaoLote, setMostrarConfirmarExclusaoLote] = useState(false);
  const [excluindoSelecionados, setExcluindoSelecionados] = useState(false);
  const [erroExclusaoLote, setErroExclusaoLote] = useState("");

  // Compartilhamento
  const [mostrarCompartilhar, setMostrarCompartilhar] = useState(false);
  const [mostrarEntrarLista, setMostrarEntrarLista] = useState(false);
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [erroCompartilhamento, setErroCompartilhamento] = useState("");
  const [carregandoCompartilhamento, setCarregandoCompartilhamento] = useState(false);
  const [codigoCopiado, setCodigoCopiado] = useState(false);
  const [entrouComSucesso, setEntrouComSucesso] = useState(false);
  const [mostrarConfirmarSair, setMostrarConfirmarSair] = useState(false);
  const [saindoDaLista, setSaindoDaLista] = useState(false);
  const [erroSairLista, setErroSairLista] = useState("");
  const [mostrarConfirmarParar, setMostrarConfirmarParar] = useState(false);
  const [parandoCompartilhamento, setParandoCompartilhamento] = useState(false);
  const [erroPararCompartilhar, setErroPararCompartilhar] = useState("");
  const [avisoPerdaAcesso, setAvisoPerdaAcesso] = useState(false);

  // Catálogo
  const [catalogo, setCatalogo] = useState([]);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [buscaCatalogo, setBuscaCatalogo] = useState("");
  const [itemEditandoCatalogo, setItemEditandoCatalogo] = useState(null);
  const [nomeEditadoCatalogo, setNomeEditadoCatalogo] = useState("");
  const [erroCatalogo, setErroCatalogo] = useState("");
  const [selecionadosCatalogo, setSelecionadosCatalogo] = useState([]);
  const [adicionandoSelecionados, setAdicionandoSelecionados] = useState(false);
  const [modoSelecaoCatalogo, setModoSelecaoCatalogo] = useState(false);
  const [mostrarConfirmarExclusaoCatalogo, setMostrarConfirmarExclusaoCatalogo] = useState(false);
  const [excluindoDoCatalogo, setExcluindoDoCatalogo] = useState(false);

  // Menu "mais opções" do cabeçalho
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const menuRef = useRef(null);

  // Evita tratar a "perda de acesso" duas vezes (há dois listeners) ou
  // quando é o próprio usuário que está saindo da lista.
  const ignorarPerdaDeAcesso = useRef(false);

  /* ---------------------------- Efeitos ---------------------------- */

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, (usuarioAtual) => {
      setUsuario(usuarioAtual);
      setEmailVerificado(Boolean(usuarioAtual?.emailVerified));
      setMensagemVerificacao(null);
      setCarregando(false);
    });
    return () => cancelar();
  }, []);

  useEffect(() => {
    prepararLista();
  }, [usuario, emailVerificado]);

  // Catálogo em tempo real (sincroniza entre celular e computador)
  useEffect(() => {
    if (!usuario || !emailVerificado) {
      setCatalogo([]);
      return;
    }
    const cancelar = onSnapshot(
      doc(db, "usuarios", usuario.uid),
      (snapshot) => {
        setCatalogo(snapshot.exists() ? snapshot.data().catalogo || [] : []);
      },
      (erro) => console.error("Erro ao carregar catálogo:", erro)
    );
    return () => cancelar();
  }, [usuario, emailVerificado]);

  useEffect(() => {
    if (!usuario || !listaId) {
      setProdutos([]);
      return;
    }
    const cancelar = onSnapshot(
      collection(db, "listas", listaId, "produtos"),
      (snapshot) => {
        setProdutos(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (erro) => {
        if (erro.code === "permission-denied") {
          tratarPerdaDeAcesso();
          return;
        }
        console.error("Erro ao carregar produtos:", erro);
      }
    );
    return () => cancelar();
  }, [usuario, listaId]);

  useEffect(() => {
    if (!usuario || !listaId) {
      setMembrosLista([]);
      return;
    }
    const cancelar = onSnapshot(
      doc(db, "listas", listaId),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const dados = snapshot.data();
        setMembrosLista(dados.membros || []);
        setDonoIdLista(dados.donoId || null);
        if (dados.codigoCompartilhamento) {
          setCodigoCompartilhamento(dados.codigoCompartilhamento);
        }
      },
      (erro) => {
        if (erro.code === "permission-denied") {
          tratarPerdaDeAcesso();
          return;
        }
        console.error("Erro ao observar lista:", erro);
      }
    );
    return () => cancelar();
  }, [usuario, listaId]);

  // Fecha o menu "mais opções" ao clicar fora dele
  useEffect(() => {
    if (!mostrarMenu) return;
    function aoClicarFora(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMostrarMenu(false);
    }
    document.addEventListener("pointerdown", aoClicarFora);
    return () => document.removeEventListener("pointerdown", aoClicarFora);
  }, [mostrarMenu]);

  // Esc fecha a janela que está por cima
  useEffect(() => {
    function aoApertarTecla(e) {
      if (e.key !== "Escape") return;
      if (mostrarMenu) setMostrarMenu(false);
      else if (avisoPerdaAcesso) setAvisoPerdaAcesso(false);
      else if (produtoParaExcluir) setProdutoParaExcluir(null);
      else if (mostrarConfirmarExclusaoCatalogo) {
        if (!excluindoDoCatalogo) setMostrarConfirmarExclusaoCatalogo(false);
      } else if (mostrarConfirmarExclusaoLote) {
        if (!excluindoSelecionados) setMostrarConfirmarExclusaoLote(false);
      } else if (mostrarConfirmarSair) {
        if (!saindoDaLista) setMostrarConfirmarSair(false);
      } else if (mostrarConfirmarParar) {
        if (!parandoCompartilhamento) setMostrarConfirmarParar(false);
      } else if (mostrarFormulario) fecharFormulario();
      else if (idProdutoAberto) setIdProdutoAberto(null);
      else if (mostrarCatalogo) {
        if (modoSelecaoCatalogo) alternarModoSelecaoCatalogo();
        else fecharCatalogo();
      }
      else if (mostrarEntrarLista) setMostrarEntrarLista(false);
      else if (mostrarCompartilhar) setMostrarCompartilhar(false);
      else if (modoSelecao) alternarModoSelecao();
    }
    document.addEventListener("keydown", aoApertarTecla);
    return () => document.removeEventListener("keydown", aoApertarTecla);
  });

  /* ------------------------ Valores derivados ------------------------ */

  // Sempre buscamos o produto aberto na lista atual, assim o modal mostra
  // as alterações feitas por outras pessoas e fecha se o produto sumir.
  const produtoAberto = produtos.find((p) => p.id === idProdutoAberto) || null;

  const catalogoOrdenado = useMemo(
    () =>
      [...catalogo].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" })
      ),
    [catalogo]
  );

  const catalogoFiltrado = useMemo(() => {
    const termo = normalizarTexto(buscaCatalogo);
    return catalogoOrdenado.filter((item) => normalizarTexto(item).startsWith(termo));
  }, [catalogoOrdenado, buscaCatalogo]);

  // Produtos que faltam primeiro, depois os já pegos; ambos em ordem alfabética
  const produtosOrdenados = useMemo(
    () =>
      [...produtos].sort((a, b) => {
        if (Boolean(a.comprado) !== Boolean(b.comprado)) return a.comprado ? 1 : -1;
        return (a.nome || "").localeCompare(b.nome || "", "pt-BR", {
          sensitivity: "base",
        });
      }),
    [produtos]
  );

  const produtosFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaLista);
    return produtosOrdenados.filter((p) => normalizarTexto(p.nome).startsWith(termo));
  }, [produtosOrdenados, buscaLista]);

  const idsVisiveis = useMemo(
    () => produtosFiltrados.map((p) => p.id),
    [produtosFiltrados]
  );

  // Ignora produtos selecionados que outra pessoa já excluiu
  const selecionadosValidos = useMemo(
    () => produtosSelecionados.filter((id) => produtos.some((p) => p.id === id)),
    [produtosSelecionados, produtos]
  );

  const todosVisiveisSelecionados =
    idsVisiveis.length > 0 && idsVisiveis.every((id) => produtosSelecionados.includes(id));

  /* ------------------------------ Lista ------------------------------ */

  function limparEstadoDaLista() {
    setListaId(null);
    setProdutos([]);
    setMembrosLista([]);
    setCodigoCompartilhamento("");
    setDonoIdLista(null);
    setBuscaLista("");
    setModoSelecao(false);
    setProdutosSelecionados([]);
    setIdProdutoAberto(null);
  }

  async function prepararLista() {
    if (!usuario || !emailVerificado) {
      limparEstadoDaLista();
      setCarregandoLista(false);
      return;
    }

    setCarregandoLista(true);
    setErroLista(false);

    try {
      const usuarioRef = doc(db, "usuarios", usuario.uid);
      const usuarioSnapshot = await getDoc(usuarioRef);
      const dadosUsuario = usuarioSnapshot.exists() ? usuarioSnapshot.data() : {};

      const listaPessoalId = dadosUsuario.listaPessoalId || "";
      let idDaLista = dadosUsuario.listaId || listaPessoalId || "";
      let dadosLista = idDaLista ? await lerLista(idDaLista) : null;

      // A lista salva sumiu ou o acesso foi removido: volta para a lista pessoal
      if (!dadosLista && listaPessoalId && listaPessoalId !== idDaLista) {
        idDaLista = listaPessoalId;
        dadosLista = await lerLista(listaPessoalId);
      }

      if (!dadosLista) {
        // Usuário novo (ou sem nenhuma lista válida): cria a lista pessoal
        const novaListaRef = doc(collection(db, "listas"));
        const codigo = gerarCodigoCompartilhamento();
        dadosLista = {
          donoId: usuario.uid,
          criadoEm: new Date(),
          codigoCompartilhamento: codigo,
          membros: [usuario.uid],
        };
        await setDoc(novaListaRef, dadosLista);
        idDaLista = novaListaRef.id;
        await setDoc(
          usuarioRef,
          { listaId: idDaLista, listaPessoalId: idDaLista, email: usuario.email },
          { merge: true }
        );
        await setDoc(doc(db, "codigosCompartilhamento", codigo), { listaId: idDaLista });
      } else {
        const atualizacao = {};
        if (dadosUsuario.listaId !== idDaLista) atualizacao.listaId = idDaLista;
        // Usuários antigos ainda não têm listaPessoalId salvo
        if (!listaPessoalId && dadosLista.donoId === usuario.uid) {
          atualizacao.listaPessoalId = idDaLista;
        }
        if (Object.keys(atualizacao).length) {
          await setDoc(usuarioRef, atualizacao, { merge: true });
        }
      }

      const listaRef = doc(db, "listas", idDaLista);
      let codigo = dadosLista.codigoCompartilhamento;
      if (!codigo) {
        codigo = gerarCodigoCompartilhamento();
        await updateDoc(listaRef, { codigoCompartilhamento: codigo });
      }

      const codigoRef = doc(db, "codigosCompartilhamento", codigo);
      const codigoSnapshot = await getDoc(codigoRef);
      if (!codigoSnapshot.exists()) {
        await setDoc(codigoRef, { listaId: idDaLista });
      }

      setListaId(idDaLista);
      setDonoIdLista(dadosLista.donoId || null);
      setMembrosLista(dadosLista.membros || []);
      setCodigoCompartilhamento(codigo);
    } catch (erro) {
      console.error("Erro ao preparar lista:", erro);
      setErroLista(true);
    } finally {
      setCarregandoLista(false);
    }
  }

  async function tratarPerdaDeAcesso() {
    if (!usuario || ignorarPerdaDeAcesso.current) return;
    ignorarPerdaDeAcesso.current = true;

    setAvisoPerdaAcesso(true);
    limparEstadoDaLista();
    try {
      await setDoc(doc(db, "usuarios", usuario.uid), { listaId: "" }, { merge: true });
    } catch (erro) {
      console.error("Erro ao limpar lista do usuário:", erro);
    }
    await prepararLista();

    ignorarPerdaDeAcesso.current = false;
  }

  /* ------------------------ Verificação de e-mail ------------------------ */

  async function handleReenviarVerificacao() {
    if (!usuario) return;
    setReenviando(true);
    setMensagemVerificacao(null);
    try {
      await sendEmailVerification(usuario);
      setMensagemVerificacao({
        tipo: "sucesso",
        texto: "E-mail reenviado! Confira sua caixa de entrada ou sua caixa de spam.",
      });
    } catch (erro) {
      setMensagemVerificacao({
        tipo: "erro",
        texto:
          erro.code === "auth/too-many-requests"
            ? "Você pediu muitos e-mails seguidos. Aguarde alguns minutos."
            : "Não foi possível reenviar. Tente novamente.",
      });
    } finally {
      setReenviando(false);
    }
  }

  async function conferirVerificacao() {
    if (!auth.currentUser) return;
    setConferindoVerificacao(true);
    setMensagemVerificacao(null);
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        // Atualiza o token para as regras do Firestore enxergarem a verificação
        await auth.currentUser.getIdToken(true);
        setEmailVerificado(true);
      } else {
        setMensagemVerificacao({
          tipo: "erro",
          texto: "Ainda não recebemos a confirmação. Clique no link do e-mail e tente de novo.",
        });
      }
    } catch (erro) {
      setMensagemVerificacao({
        tipo: "erro",
        texto: "Não foi possível verificar agora. Tente novamente.",
      });
    } finally {
      setConferindoVerificacao(false);
    }
  }

  function fecharTodosOsModais() {
    setMostrarFormulario(false);
    setIdProdutoAberto(null);
    setIdProdutoEditando(null);
    setProdutoParaExcluir(null);
    setMostrarCompartilhar(false);
    setMostrarEntrarLista(false);
    setMostrarConfirmarSair(false);
    setMostrarConfirmarParar(false);
    setMostrarConfirmarExclusaoLote(false);
    setAvisoPerdaAcesso(false);
    setMostrarMenu(false);
    fecharCatalogo();
  }

  async function sairDaConta() {
    fecharTodosOsModais();
    try {
      await signOut(auth);
    } catch (erro) {
      console.error("Erro ao sair:", erro);
    }
  }

  /* ------------------------------ Produtos ------------------------------ */

  function estaNaListaAtual(nome, ignorarId = null) {
    return produtos.some((p) => p.id !== ignorarId && mesmoNome(p.nome, nome));
  }

  function alterarCampo(e) {
    const { name, value } = e.target;
    setNovoProduto((atual) => ({ ...atual, [name]: value }));
    setErroFormulario("");
  }

  function alterarCampoMercado(index, campo, valor) {
    setNovoProduto((atual) => {
      const mercados = [...atual.mercados];
      mercados[index] = { ...mercados[index], [campo]: valor };
      return { ...atual, mercados };
    });
    setErroFormulario("");
  }

  function escolherMercado(index, valor) {
    setNovoProduto((atual) => {
      const mercados = [...atual.mercados];
      mercados[index] =
        valor === "Outro"
          ? { ...mercados[index], local: "", outro: true }
          : { ...mercados[index], local: valor, outro: false };
      return { ...atual, mercados };
    });
    setErroFormulario("");
  }

  function adicionarMercado() {
    setNovoProduto((atual) => ({
      ...atual,
      mercados: [...atual.mercados, { local: "", preco: "", outro: false }],
    }));
  }

  function removerMercado(index) {
    setNovoProduto((atual) => ({
      ...atual,
      mercados: atual.mercados.filter((_, i) => i !== index),
    }));
  }

  function alternarComparacao() {
    const novoEstado = !compararPrecos;
    setCompararPrecos(novoEstado);
    setErroFormulario("");
    if (novoEstado && novoProduto.mercados.length === 0) {
      setNovoProduto((atual) => ({
        ...atual,
        mercados: [{ local: "", preco: "", outro: false }],
      }));
    }
  }

  function abrirFormularioAdicionar() {
    setNovoProduto(PRODUTO_VAZIO);
    setCompararPrecos(false);
    setErroFormulario("");
    setTentouSalvar(false);
    setIdProdutoEditando(null);
    setIdProdutoAberto(null);
    setMostrarFormulario(true);
  }

  function iniciarEdicao(produto) {
    const mercados = obterMercados(produto);
    setCompararPrecos(mercados.length > 0);
    setNovoProduto({
      nome: produto.nome || "",
      quantidade: produto.quantidade ?? 1,
      unidade: normalizarUnidade(produto.unidade),
      mercados: mercados.map((m) => ({
        local: m.local || "",
        preco: temPreco(m.preco) ? String(m.preco) : "",
        outro: Boolean(m.local) && !MERCADOS.includes(m.local),
      })),
    });
    setErroFormulario("");
    setTentouSalvar(false);
    setIdProdutoEditando(produto.id);
    setMostrarFormulario(true);
  }

  function fecharFormulario() {
    setMostrarFormulario(false);
    setIdProdutoEditando(null);
    setIdProdutoAberto(null);
    setErroFormulario("");
    setTentouSalvar(false);
  }

  function montarDadosProduto() {
    const nome = novoProduto.nome.trim();
    const quantidade = Number(novoProduto.quantidade);

    if (!nome) return { erro: "Digite o nome do produto." };
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return { erro: "Informe uma quantidade maior que zero." };
    }
    if (estaNaListaAtual(nome, idProdutoEditando)) {
      return { erro: "Esse produto já está na lista." };
    }

    // Mercado "Outro" sem nome: o nome é obrigatório
    if (
      compararPrecos &&
      novoProduto.mercados.some((m) => m.outro && !(m.local || "").trim())
    ) {
      return { erroNomeMercado: true };
    }

    const mercados = compararPrecos
      ? novoProduto.mercados
          .map((m) => ({
            local: (m.local || "").trim(),
            preco: temPreco(m.preco) ? Number(m.preco) : "",
          }))
          .filter((m) => m.local)
      : [];

    if (compararPrecos && mercados.length === 0) {
      return { erro: "Escolha ao menos um mercado ou desative a opção de mercados." };
    }
    if (new Set(mercados.map((m) => normalizarTexto(m.local))).size !== mercados.length) {
      return { erro: "Você escolheu o mesmo mercado mais de uma vez." };
    }
    if (mercados.some((m) => temPreco(m.preco) && m.preco < 0)) {
      return { erro: "O preço não pode ser negativo." };
    }

    return {
      dados: { nome, quantidade, unidade: novoProduto.unidade, mercados },
    };
  }

  // Se o produto renomeado veio do catálogo, devolve o catálogo com o nome
  // novo no lugar do antigo; devolve null quando não há nada para mudar.
  function renomearNoCatalogo(nomeAntigo, nomeNovo) {
    if (!nomeAntigo || nomeAntigo === nomeNovo) return null;
    const itemAntigo =
      catalogo.find((item) => item === nomeAntigo) ||
      catalogo.find((item) => mesmoNome(item, nomeAntigo));
    if (!itemAntigo) return null;

    // Evita duplicar se o nome novo já existir no catálogo
    const semDuplicados = catalogo.filter(
      (item) => item === itemAntigo || !mesmoNome(item, nomeNovo)
    );
    return semDuplicados.map((item) => (item === itemAntigo ? nomeNovo : item));
  }

  async function salvarProduto(e) {
    e.preventDefault();
    if (!listaId) return setErroFormulario("Sua lista ainda está sendo preparada.");

    const { erro, erroNomeMercado, dados } = montarDadosProduto();

    // Mercado "Outro" sem nome: o aviso aparece só no campo, sem mensagem geral
    if (erroNomeMercado) {
      setErroFormulario("");
      setTentouSalvar(true);
      const indice = novoProduto.mercados.findIndex(
        (m) => m.outro && !(m.local || "").trim()
      );
      setTimeout(() => document.getElementById(`nome-mercado-${indice}`)?.focus(), 0);
      return;
    }

    if (erro) return setErroFormulario(erro);

    try {
      setSalvandoProduto(true);
      setErroFormulario("");
      if (idProdutoEditando) {
        const produtoRef = doc(db, "listas", listaId, "produtos", idProdutoEditando);
        const nomeAntigo = produtos.find((p) => p.id === idProdutoEditando)?.nome || "";
        const catalogoAtualizado = renomearNoCatalogo(nomeAntigo, dados.nome);

        if (catalogoAtualizado) {
          // Renomeia na lista e no catálogo juntos ("tudo ou nada")
          const lote = writeBatch(db);
          lote.update(produtoRef, dados);
          lote.set(
            doc(db, "usuarios", usuario.uid),
            { catalogo: catalogoAtualizado },
            { merge: true }
          );
          await lote.commit();
        } else {
          await updateDoc(produtoRef, dados);
        }
      } else {
        await addDoc(collection(db, "listas", listaId, "produtos"), {
          ...dados,
          comprado: false,
          criadoPor: usuario.uid,
        });
      }
      fecharFormulario();
    } catch (falha) {
      console.error("Erro ao salvar produto:", falha);
      setErroFormulario(
        idProdutoEditando
          ? "Não foi possível salvar as alterações. Tente novamente."
          : "Não foi possível adicionar o produto. Tente novamente."
      );
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function alternarComprado(id) {
    if (!listaId) return;
    const produto = produtos.find((p) => p.id === id);
    if (!produto) return;
    try {
      await updateDoc(doc(db, "listas", listaId, "produtos", id), {
        comprado: !produto.comprado,
      });
    } catch (erro) {
      console.error("Erro ao marcar produto:", erro);
      alert("Não foi possível marcar o produto. Tente novamente.");
    }
  }

  async function confirmarExclusao() {
    if (!produtoParaExcluir || !listaId) return;
    try {
      await deleteDoc(doc(db, "listas", listaId, "produtos", produtoParaExcluir.id));
      setProdutoParaExcluir(null);
      setIdProdutoAberto(null);
    } catch (erro) {
      console.error("Erro ao excluir produto:", erro);
      alert("Não foi possível excluir o produto. Tente novamente.");
    }
  }

  function clicarProduto(id) {
    if (modoSelecao) alternarSelecaoProduto(id);
    else setIdProdutoAberto(id);
  }

  /* -------------------------- Seleção múltipla -------------------------- */

  function alternarModoSelecao() {
    setModoSelecao((atual) => !atual);
    setProdutosSelecionados([]);
  }

  function alternarSelecaoProduto(id) {
    setProdutosSelecionados((atuais) =>
      atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id]
    );
  }

  // "Selecionar todos" considera só os produtos visíveis (respeita a busca)
  function alternarSelecaoTodos() {
    setProdutosSelecionados((atuais) =>
      todosVisiveisSelecionados
        ? atuais.filter((id) => !idsVisiveis.includes(id))
        : [...new Set([...atuais, ...idsVisiveis])]
    );
  }

  async function excluirProdutosSelecionados() {
    if (!listaId || selecionadosValidos.length === 0 || excluindoSelecionados) return;
    try {
      setExcluindoSelecionados(true);
      setErroExclusaoLote("");
      await executarEmLotes(selecionadosValidos, (lote, id) =>
        lote.delete(doc(db, "listas", listaId, "produtos", id))
      );
      setProdutosSelecionados([]);
      setModoSelecao(false);
      setMostrarConfirmarExclusaoLote(false);
    } catch (erro) {
      console.error("Erro ao excluir produtos selecionados:", erro);
      setErroExclusaoLote("Não foi possível excluir os produtos. Tente novamente.");
    } finally {
      setExcluindoSelecionados(false);
    }
  }

  /* --------------------------- Compartilhamento --------------------------- */

  async function abrirCompartilhamento() {
    try {
      setErroCompartilhamento("");
      setCodigoCopiado(false);
      if (!codigoCompartilhamento && listaId) {
        const listaRef = doc(db, "listas", listaId);
        const snapshot = await getDoc(listaRef);
        if (snapshot.exists()) {
          let codigo = snapshot.data().codigoCompartilhamento;
          if (!codigo) {
            codigo = gerarCodigoCompartilhamento();
            await updateDoc(listaRef, { codigoCompartilhamento: codigo });
          }
          await setDoc(doc(db, "codigosCompartilhamento", codigo), { listaId });
          setCodigoCompartilhamento(codigo);
        }
      }
    } catch (erro) {
      setErroCompartilhamento("Erro ao carregar o código.");
    } finally {
      setMostrarCompartilhar(true);
    }
  }

  function abrirEntrarLista() {
    setErroCompartilhamento("");
    setCodigoDigitado("");
    setEntrouComSucesso(false);
    setMostrarEntrarLista(true);
  }

  async function entrarEmLista() {
    const codigo = codigoDigitado.trim().toUpperCase();
    if (codigo.length !== 6) return setErroCompartilhamento("O código tem 6 caracteres.");
    if (codigo === codigoCompartilhamento) {
      return setErroCompartilhamento("Esse é o código da sua própria lista.");
    }
    if (!usuario) return setErroCompartilhamento("Faça login primeiro.");

    try {
      setCarregandoCompartilhamento(true);
      setErroCompartilhamento("");

      const codigoSnapshot = await getDoc(doc(db, "codigosCompartilhamento", codigo));
      if (!codigoSnapshot.exists()) return setErroCompartilhamento("Código inválido.");

      const novaListaId = codigoSnapshot.data().listaId;
      if (!novaListaId) return setErroCompartilhamento("Lista não encontrada.");
      if (novaListaId === listaId) return setErroCompartilhamento("Você já está nessa lista.");

      const listaRef = doc(db, "listas", novaListaId);
      const listaSnapshot = await getDoc(listaRef);
      if (!listaSnapshot.exists()) return setErroCompartilhamento("Essa lista não existe mais.");
      const dadosLista = listaSnapshot.data();

      await updateDoc(listaRef, { membros: arrayUnion(usuario.uid) });

      // Guarda a lista pessoal para o usuário poder voltar para ela depois
      await setDoc(
        doc(db, "usuarios", usuario.uid),
        { listaId: novaListaId, listaPessoalId: listaId, email: usuario.email },
        { merge: true }
      );

      setListaId(novaListaId);
      setCodigoCompartilhamento(dadosLista.codigoCompartilhamento || codigo);
      setDonoIdLista(dadosLista.donoId);
      setProdutos([]);
      setBuscaLista("");
      setCodigoDigitado("");
      setEntrouComSucesso(true);
      setTimeout(() => {
        setMostrarEntrarLista(false);
        setEntrouComSucesso(false);
      }, 1500);
    } catch (erro) {
      console.error("Erro ao entrar na lista:", erro);
      setErroCompartilhamento("Não foi possível entrar na lista. Tente novamente.");
    } finally {
      setCarregandoCompartilhamento(false);
    }
  }

  async function copiarCodigo() {
    if (!codigoCompartilhamento) return;
    try {
      await navigator.clipboard.writeText(codigoCompartilhamento);
      setCodigoCopiado(true);
      setTimeout(() => setCodigoCopiado(false), 2000);
    } catch (erro) {
      console.error(erro);
    }
  }

  async function sairDaListaCompartilhada() {
    if (!listaId || !usuario) return;
    ignorarPerdaDeAcesso.current = true;
    try {
      setSaindoDaLista(true);
      setErroSairLista("");
      await updateDoc(doc(db, "listas", listaId), { membros: arrayRemove(usuario.uid) });
      await setDoc(doc(db, "usuarios", usuario.uid), { listaId: "" }, { merge: true });
      limparEstadoDaLista();
      setMostrarConfirmarSair(false);
      await prepararLista(); // volta para a lista pessoal
    } catch (erro) {
      console.error("Erro ao sair da lista:", erro);
      setErroSairLista("Não foi possível sair da lista. Tente novamente.");
    } finally {
      setSaindoDaLista(false);
      ignorarPerdaDeAcesso.current = false;
    }
  }

  async function pararDeCompartilhar() {
    if (!listaId || !usuario) return;
    try {
      setParandoCompartilhamento(true);
      setErroPararCompartilhar("");

      const codigoAntigo = codigoCompartilhamento;
      const novoCodigo = gerarCodigoCompartilhamento();

      await updateDoc(doc(db, "listas", listaId), {
        membros: [usuario.uid],
        codigoCompartilhamento: novoCodigo,
      });
      await setDoc(doc(db, "codigosCompartilhamento", novoCodigo), { listaId });
      if (codigoAntigo && codigoAntigo !== novoCodigo) {
        await deleteDoc(doc(db, "codigosCompartilhamento", codigoAntigo));
      }

      setCodigoCompartilhamento(novoCodigo);
      setMembrosLista([usuario.uid]);
      setMostrarConfirmarParar(false);
    } catch (erro) {
      console.error("Erro ao parar de compartilhar:", erro);
      setErroPararCompartilhar("Não foi possível parar de compartilhar. Tente novamente.");
    } finally {
      setParandoCompartilhamento(false);
    }
  }

  /* ------------------------------ Catálogo ------------------------------ */

  function existeNoCatalogo(nome, ignorar = null) {
    return catalogo.some((item) => item !== ignorar && mesmoNome(item, nome));
  }

  const nomeNovoCatalogo = buscaCatalogo.trim();
  const podeAdicionarAoCatalogo =
    nomeNovoCatalogo.length > 0 && !existeNoCatalogo(nomeNovoCatalogo);

  async function adicionarAoCatalogo() {
    if (!usuario) return;
    if (!nomeNovoCatalogo) return setErroCatalogo("Digite o nome do produto.");
    if (existeNoCatalogo(nomeNovoCatalogo)) {
      return setErroCatalogo("Esse produto já está no catálogo.");
    }
    try {
      setErroCatalogo("");
      // arrayUnion evita apagar itens adicionados em outro aparelho
      await setDoc(
        doc(db, "usuarios", usuario.uid),
        { catalogo: arrayUnion(nomeNovoCatalogo) },
        { merge: true }
      );
      setBuscaCatalogo("");
    } catch (erro) {
      setErroCatalogo("Erro ao adicionar ao catálogo.");
    }
  }

  async function salvarEdicaoCatalogo() {
    if (!usuario) return;
    const nome = nomeEditadoCatalogo.trim();
    if (!nome) return setErroCatalogo("Digite o nome do produto.");
    if (existeNoCatalogo(nome, itemEditandoCatalogo)) {
      return setErroCatalogo("Esse produto já está no catálogo.");
    }

    // Produtos da lista atual que têm o nome antigo e serão renomeados junto
    const produtosParaRenomear = listaId
      ? produtos.filter((p) => mesmoNome(p.nome, itemEditandoCatalogo))
      : [];
    const nomeJaUsadoNaLista = produtos.some(
      (p) => !mesmoNome(p.nome, itemEditandoCatalogo) && mesmoNome(p.nome, nome)
    );
    if (produtosParaRenomear.length > 0 && nomeJaUsadoNaLista) {
      return setErroCatalogo("Já existe um produto com esse nome na lista.");
    }

    try {
      setErroCatalogo("");
      // Renomeia no catálogo e na lista juntos ("tudo ou nada")
      const lote = writeBatch(db);
      lote.set(
        doc(db, "usuarios", usuario.uid),
        { catalogo: catalogo.map((item) => (item === itemEditandoCatalogo ? nome : item)) },
        { merge: true }
      );
      produtosParaRenomear.forEach((p) =>
        lote.update(doc(db, "listas", listaId, "produtos", p.id), { nome })
      );
      await lote.commit();
      setSelecionadosCatalogo((atual) =>
        atual.map((item) => (item === itemEditandoCatalogo ? nome : item))
      );
      setItemEditandoCatalogo(null);
      setNomeEditadoCatalogo("");
    } catch (erro) {
      setErroCatalogo("Erro ao salvar alteração.");
    }
  }

  async function removerDoCatalogo(item) {
    if (!usuario) return;
    try {
      setErroCatalogo("");
      await setDoc(
        doc(db, "usuarios", usuario.uid),
        { catalogo: arrayRemove(item) },
        { merge: true }
      );
      setSelecionadosCatalogo((atual) => atual.filter((i) => i !== item));
    } catch (erro) {
      setErroCatalogo("Erro ao remover do catálogo.");
    }
  }

  function alternarSelecaoCatalogo(item) {
    setErroCatalogo("");
    setSelecionadosCatalogo((atual) =>
      atual.includes(item) ? atual.filter((i) => i !== item) : [...atual, item]
    );
  }

  async function adicionarSelecionadosALista() {
    if (!listaId || selecionadosCatalogo.length === 0) return;
    const nomes = selecionadosCatalogo.filter((nome) => !estaNaListaAtual(nome));
    if (nomes.length === 0) return fecharCatalogo();

    try {
      setAdicionandoSelecionados(true);
      setErroCatalogo("");
      await executarEmLotes(nomes, (lote, nome) =>
        lote.set(doc(collection(db, "listas", listaId, "produtos")), {
          nome,
          quantidade: 1,
          unidade: "unidade(s)",
          mercados: [],
          comprado: false,
          criadoPor: usuario.uid,
        })
      );
      fecharCatalogo();
    } catch (erro) {
      setErroCatalogo("Erro ao adicionar os produtos à lista.");
    } finally {
      setAdicionandoSelecionados(false);
    }
  }

  function abrirCatalogo() {
    setErroCatalogo("");
    setMostrarCatalogo(true);
  }

  // Modo seleção do catálogo: as caixinhas passam a marcar itens para excluir
  function alternarModoSelecaoCatalogo() {
    setModoSelecaoCatalogo((atual) => !atual);
    setSelecionadosCatalogo([]);
    setItemEditandoCatalogo(null);
    setErroCatalogo("");
  }

  // "Selecionar todos" considera só os itens visíveis (respeita a busca)
  const todosCatalogoSelecionados =
    catalogoFiltrado.length > 0 &&
    catalogoFiltrado.every((item) => selecionadosCatalogo.includes(item));

  function alternarSelecaoTodosCatalogo() {
    setSelecionadosCatalogo((atuais) =>
      todosCatalogoSelecionados
        ? atuais.filter((item) => !catalogoFiltrado.includes(item))
        : [...new Set([...atuais, ...catalogoFiltrado])]
    );
  }

  async function excluirSelecionadosDoCatalogo() {
    if (!usuario || selecionadosCatalogo.length === 0 || excluindoDoCatalogo) return;
    try {
      setExcluindoDoCatalogo(true);
      setErroCatalogo("");
      await setDoc(
        doc(db, "usuarios", usuario.uid),
        { catalogo: arrayRemove(...selecionadosCatalogo) },
        { merge: true }
      );
      setSelecionadosCatalogo([]);
      setModoSelecaoCatalogo(false);
    } catch (erro) {
      console.error("Erro ao excluir do catálogo:", erro);
      setErroCatalogo("Erro ao excluir os produtos do catálogo.");
    } finally {
      setExcluindoDoCatalogo(false);
      setMostrarConfirmarExclusaoCatalogo(false);
    }
  }

  function fecharCatalogo() {
    setModoSelecaoCatalogo(false);
    setMostrarConfirmarExclusaoCatalogo(false);
    setMostrarCatalogo(false);
    setBuscaCatalogo("");
    setItemEditandoCatalogo(null);
    setNomeEditadoCatalogo("");
    setErroCatalogo("");
    setSelecionadosCatalogo([]);
  }

  /* ------------------------------ Telas ------------------------------ */

  if (carregando) {
    return (
      <div className="tela-carregando">
        <div className="spinner" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  if (!emailVerificado) {
    return (
      <div className="tela-verificacao-card">
        <div className="card-verificacao">
          <div className="icone-circulo">
            <Mail size={28} strokeWidth={1.75} />
          </div>
          <h2>Verifique seu e-mail</h2>
          <p>
            Enviamos um link de confirmação para <strong>{usuario.email}</strong>.
            <br />
            Clique no link e depois toque em “Já confirmei meu e-mail”.
          </p>

          {mensagemVerificacao && (
            <div className={`mensagem-verificacao ${mensagemVerificacao.tipo}`} role="status">
              {mensagemVerificacao.texto}
            </div>
          )}

          <div className="botoes-verificacao">
            <button
              className="botao-ok-verificacao"
              onClick={conferirVerificacao}
              disabled={conferindoVerificacao}
            >
              {conferindoVerificacao ? "Verificando..." : "Já confirmei meu e-mail"}
            </button>
            <button
              className="botao-reenviar-verificacao"
              onClick={handleReenviarVerificacao}
              disabled={reenviando}
            >
              {reenviando ? "Enviando..." : "Reenviar e-mail de verificação"}
            </button>
            <button className="botao-texto-verificacao" onClick={sairDaConta}>
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (carregandoLista) {
    return (
      <div className="tela-carregando">
        <div className="spinner" />
        <p>Preparando sua lista...</p>
        <span>Isso leva só um instante.</span>
      </div>
    );
  }

  if (erroLista) {
    return (
      <div className="tela-carregando">
        <p>Não foi possível carregar sua lista.</p>
        <span>Confira sua conexão com a internet e tente novamente.</span>
        <button className="botao-tentar-novamente" onClick={prepararLista}>
          Tentar novamente
        </button>
        <button className="botao-texto-verificacao" onClick={sairDaConta}>
          Sair da conta
        </button>
      </div>
    );
  }

  const totalGeral = produtos.reduce((total, p) => {
    const precos = obterMercadosComPreco(p).map((m) => Number(m.preco));
    const menor = precos.length ? Math.min(...precos) : 0;
    return total + menor * Number(p.quantidade);
  }, 0);

  const temPrecos = produtos.some((p) => obterMercadosComPreco(p).length > 0);
  const produtosComprados = produtos.filter((p) => p.comprado).length;
  const produtosRestantes = produtos.length - produtosComprados;
  const progresso = produtos.length > 0 ? (produtosComprados / produtos.length) * 100 : 0;
  const ehListaPropria = !donoIdLista || donoIdLista === usuario.uid;
  const estaCompartilhando = membrosLista.length > 1;
  const tituloLista = ehListaPropria ? "Sua lista" : "Lista compartilhada";
  const qtdSelecionados = selecionadosValidos.length;
  const listaVazia = produtos.length === 0;

  function abrirDoMenu(acao) {
    setMostrarMenu(false);
    acao();
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-conteudo">
          <div className="logo-area">
            <div className="logo">
              <img src={logoCarrinho} alt="" />
            </div>
            <div className="logo-textos">
              <h1>Lista de compras</h1>
              <p>{usuario.email}</p>
            </div>
          </div>

          <div className="acoes-header">
            <button
              type="button"
              className="botao-icone"
              onClick={abrirCompartilhamento}
              aria-label={estaCompartilhando ? "Compartilhar lista (compartilhada)" : "Compartilhar lista"}
              title="Compartilhar lista"
            >
              <Share size={20} strokeWidth={1.75} />
              {estaCompartilhando && <span className="bolinha-compartilhada" aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="botao-icone"
              onClick={abrirCatalogo}
              aria-label="Catálogo"
              title="Catálogo"
            >
              <ListChecks size={20} strokeWidth={1.75} />
            </button>

            <div className="menu-area" ref={menuRef}>
              <button
                type="button"
                className="botao-icone"
                onClick={() => setMostrarMenu((atual) => !atual)}
                aria-label="Mais opções"
                aria-haspopup="menu"
                aria-expanded={mostrarMenu}
                title="Mais opções"
              >
                <EllipsisVertical size={20} strokeWidth={1.75} />
              </button>

              {mostrarMenu && (
                <div className="menu-opcoes" role="menu">
                  {ehListaPropria && !estaCompartilhando && (
                    <button type="button" role="menuitem" onClick={() => abrirDoMenu(abrirEntrarLista)}>
                      <LogIn size={18} strokeWidth={1.75} />
                      Entrar em uma lista
                    </button>
                  )}
                  {ehListaPropria && estaCompartilhando && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        abrirDoMenu(() => {
                          setErroPararCompartilhar("");
                          setMostrarConfirmarParar(true);
                        })
                      }
                    >
                      <UserMinus size={18} strokeWidth={1.75} />
                      Parar de compartilhar
                    </button>
                  )}
                  {!ehListaPropria && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        abrirDoMenu(() => {
                          setErroSairLista("");
                          setMostrarConfirmarSair(true);
                        })
                      }
                    >
                      <DoorOpen size={18} strokeWidth={1.75} />
                      Sair desta lista
                    </button>
                  )}
                  <div className="menu-separador" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-perigo"
                    onClick={() => abrirDoMenu(sairDaConta)}
                  >
                    <LogOut size={18} strokeWidth={1.75} />
                    Sair da conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`conteudo ${modoSelecao ? "conteudo-com-barra" : ""}`}>
        {listaVazia ? (
          <section className="lista-vazia">
            <div className="ilustracao-carrinho" aria-hidden="true">
              <Sparkle className="brilho brilho-esquerdo" size={16} strokeWidth={1.75} />
              <Sparkle className="brilho brilho-direito" size={12} strokeWidth={1.75} />
              <div className="alca alca-esquerda" />
              <div className="alca alca-direita" />
              <div className="cesta">
                <span />
                <span />
                <span />
              </div>
            </div>
            <h2>Sua lista está vazia</h2>
            <div className="lista-vazia-botoes">
              <button type="button" className="botao-primario" onClick={abrirFormularioAdicionar}>
                <Plus size={18} strokeWidth={2} />
                Adicionar produto
              </button>
              <button type="button" className="botao-secundario" onClick={abrirCatalogo}>
                <ListChecks size={18} strokeWidth={1.75} />
                Abrir catálogo
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="progresso-card">
              <div className="progresso-topo">
                <div>
                  <span>Progresso da compra</span>
                  <strong>
                    {produtosComprados} de {produtos.length}
                  </strong>
                </div>
                <div className="porcentagem">{Math.round(progresso)}%</div>
              </div>
              <div className="barra">
                <div className="barra-preenchida" style={{ width: `${progresso}%` }} />
              </div>
              {temPrecos && (
                <p className="progresso-estimado">
                  Total estimado: <strong>{formatarPreco(totalGeral)}</strong>
                </p>
              )}
            </section>

            <div className="titulo-lista">
              <div>
                <h2>{tituloLista}</h2>
                <p>
                  {produtosRestantes === 0
                    ? "Todos os produtos foram pegos"
                    : `${produtosRestantes} ${produtosRestantes === 1 ? "produto falta" : "produtos faltam"}`}
                </p>
              </div>
              <button
                type="button"
                className={`botao-selecionar ${modoSelecao ? "botao-selecionar-ativo" : ""}`}
                onClick={alternarModoSelecao}
              >
                {modoSelecao ? (
                  <>
                    <X size={16} strokeWidth={2} /> Cancelar
                  </>
                ) : (
                  <>
                    <SquareCheck size={16} strokeWidth={1.75} /> Selecionar
                  </>
                )}
              </button>
            </div>

            <div className="busca-produtos">
              <Search className="busca-produtos-icone" size={18} strokeWidth={1.75} aria-hidden="true" />
              <input
                type="search"
                className="busca-produtos-input"
                placeholder="Buscar produto na lista"
                value={buscaLista}
                onChange={(e) => setBuscaLista(e.target.value)}
                aria-label="Buscar produto na lista de compras"
              />
              {buscaLista && (
                <button
                  type="button"
                  className="busca-produtos-limpar"
                  onClick={() => setBuscaLista("")}
                  aria-label="Limpar busca da lista"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              )}
            </div>

            {modoSelecao && (
              <div className="barra-selecao-produtos">
                <label className="selecionar-todos">
                  <input
                    type="checkbox"
                    checked={todosVisiveisSelecionados}
                    onChange={alternarSelecaoTodos}
                    disabled={idsVisiveis.length === 0}
                  />
                  {buscaLista.trim()
                    ? `Selecionar os encontrados (${idsVisiveis.length})`
                    : `Selecionar todos (${idsVisiveis.length})`}
                </label>
              </div>
            )}

            {produtosFiltrados.length === 0 ? (
              <div className="busca-sem-resultado">
                <Search size={28} strokeWidth={1.5} aria-hidden="true" />
                <p>Nenhum produto encontrado para “{buscaLista.trim()}”.</p>
                <button type="button" className="botao-link" onClick={() => setBuscaLista("")}>
                  Limpar busca
                </button>
              </div>
            ) : (
              <section className="lista">
                {/* Cabeçalho das colunas: só aparece no computador */}
                <div className="lista-cabecalho-pc" aria-hidden="true">
                  <span />
                  <span>Produto</span>
                  <span>Quantidade</span>
                  <span>Mercados</span>
                  <span className="coluna-total">Total</span>
                  <span />
                </div>
                {produtosFiltrados.map((produto) => {
                  const selecionado = modoSelecao && produtosSelecionados.includes(produto.id);
                  return (
                    <article
                      key={produto.id}
                      role="button"
                      tabIndex={0}
                      className={`produto-linha ${produto.comprado ? "produto-comprado" : ""} ${selecionado ? "produto-selecionado" : ""}`}
                      onClick={() => clicarProduto(produto.id)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          clicarProduto(produto.id);
                        }
                      }}
                    >
                      {modoSelecao ? (
                        <input
                          className="checkbox-selecao-produto"
                          type="checkbox"
                          checked={selecionado}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => alternarSelecaoProduto(produto.id)}
                          aria-label={`Selecionar ${produto.nome}`}
                        />
                      ) : (
                        <button
                          type="button"
                          className={`check ${produto.comprado ? "check-ativo" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            alternarComprado(produto.id);
                          }}
                          aria-label={
                            produto.comprado
                              ? `Desmarcar ${produto.nome} como pego`
                              : `Marcar ${produto.nome} como pego`
                          }
                        >
                          {produto.comprado && <Check size={14} strokeWidth={3} />}
                        </button>
                      )}
                      <div className="produto-info">
                        <h3>{produto.nome}</h3>
                        <ResumoProduto produto={produto} />
                      </div>
                      <span className="coluna-pc coluna-quantidade">{textoQuantidade(produto)}</span>
                      <ColunasMercado produto={produto} />
                      <ChevronRight className="coluna-pc coluna-seta" size={18} strokeWidth={1.75} aria-hidden="true" />
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </main>

      {!modoSelecao && !listaVazia && (
        <button
          type="button"
          className="botao-flutuante"
          onClick={abrirFormularioAdicionar}
          aria-label="Adicionar produto"
          title="Adicionar produto"
        >
          <Plus size={26} strokeWidth={2} />
        </button>
      )}

      {modoSelecao && !listaVazia && (
        <div className="barra-acoes-selecao">
          <div className="barra-acoes-selecao-conteudo">
            <span>
              <strong>{qtdSelecionados}</strong>{" "}
              {qtdSelecionados === 1 ? "selecionado" : "selecionados"}
            </span>
            <button
              type="button"
              className="botao-excluir-selecionados"
              onClick={() => {
                setErroExclusaoLote("");
                setMostrarConfirmarExclusaoLote(true);
              }}
              disabled={qtdSelecionados === 0}
            >
              <Trash2 size={18} strokeWidth={1.75} />
              Excluir
            </button>
          </div>
        </div>
      )}

      {mostrarCompartilhar && (
        <div className="modal-fundo" onClick={() => setMostrarCompartilhar(false)}>
          <div className="modal-compartilhamento" onClick={(e) => e.stopPropagation()}>
            <button className="fechar" onClick={() => setMostrarCompartilhar(false)} aria-label="Fechar">
              <X size={20} strokeWidth={1.75} />
            </button>
            <div className="icone-circulo">
              <Share size={26} strokeWidth={1.75} />
            </div>
            <h2>Compartilhar lista</h2>
            <p>Envie este código para alguém entrar na mesma lista.</p>
            {erroCompartilhamento ? (
              <div className="erro-compartilhamento">{erroCompartilhamento}</div>
            ) : (
              <div className="codigo-box">
                <strong>{codigoCompartilhamento || "Carregando..."}</strong>
              </div>
            )}
            <button
              className={`botao-copiar ${codigoCopiado ? "copiado" : ""}`}
              onClick={copiarCodigo}
              disabled={!codigoCompartilhamento}
            >
              {codigoCopiado ? (
                <>
                  <Check size={18} strokeWidth={2} /> Copiado!
                </>
              ) : (
                <>
                  <Copy size={18} strokeWidth={1.75} /> Copiar código
                </>
              )}
            </button>
            <div className="aviso-compartilhamento">
              <Info size={18} strokeWidth={1.75} aria-hidden="true" />
              <p>
                Todos que entrarem usando este código poderão visualizar, adicionar, editar,
                marcar e excluir produtos da lista.
              </p>
            </div>
          </div>
        </div>
      )}

      {mostrarEntrarLista && (
        <div className="modal-fundo" onClick={() => setMostrarEntrarLista(false)}>
          <div className="modal-compartilhamento" onClick={(e) => e.stopPropagation()}>
            <button className="fechar" onClick={() => setMostrarEntrarLista(false)} aria-label="Fechar">
              <X size={20} strokeWidth={1.75} />
            </button>
            {entrouComSucesso ? (
              <>
                <div className="icone-circulo icone-circulo-sucesso">
                  <Check size={28} strokeWidth={2} />
                </div>
                <h2>Você entrou na lista!</h2>
                <p>Agora você já pode ver e adicionar produtos.</p>
              </>
            ) : (
              <>
                <div className="icone-circulo">
                  <LogIn size={26} strokeWidth={1.75} />
                </div>
                <h2>Entrar em uma lista</h2>
                <p>Digite o código de 6 caracteres que você recebeu.</p>
                <input
                  className="input-codigo"
                  type="text"
                  placeholder="Ex: ABC123"
                  maxLength="6"
                  autoFocus
                  autoComplete="off"
                  value={codigoDigitado}
                  onChange={(e) => {
                    setCodigoDigitado(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                    setErroCompartilhamento("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && entrarEmLista()}
                />
                {erroCompartilhamento && (
                  <div className="erro-compartilhamento">{erroCompartilhamento}</div>
                )}
                <button
                  className="botao-entrar"
                  onClick={entrarEmLista}
                  disabled={carregandoCompartilhamento}
                >
                  {carregandoCompartilhamento ? "Entrando..." : "Entrar na lista"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {mostrarCatalogo && (
        <div className="modal-fundo" onClick={fecharCatalogo}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cabecalho">
              <div>
                <h2>Catálogo</h2>
                <p>Produtos que você costuma comprar</p>
              </div>
              <button className="fechar" onClick={fecharCatalogo} aria-label="Fechar">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            {/* Um campo só: filtra enquanto digita e adiciona se não existir */}
            <div className="catalogo-form">
              <div className="busca-produtos">
                <Search className="busca-produtos-icone" size={18} strokeWidth={1.75} aria-hidden="true" />
                <input
                  type="search"
                  className="busca-produtos-input"
                  placeholder="Buscar ou adicionar produto..."
                  value={buscaCatalogo}
                  onChange={(e) => {
                    setBuscaCatalogo(e.target.value);
                    setErroCatalogo("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarAoCatalogo();
                    }
                  }}
                  aria-label="Buscar ou adicionar produto no catálogo"
                />
                {buscaCatalogo && (
                  <button
                    type="button"
                    className="busca-produtos-limpar"
                    onClick={() => setBuscaCatalogo("")}
                    aria-label="Limpar busca do catálogo"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="botao-catalogo-adicionar"
                onClick={adicionarAoCatalogo}
                disabled={!podeAdicionarAoCatalogo}
              >
                <Plus size={18} strokeWidth={2} />
                Adicionar
              </button>
            </div>

            {erroCatalogo && <div className="erro-catalogo">{erroCatalogo}</div>}

            {catalogoOrdenado.length === 0 ? (
              <div className="catalogo-vazio">
                <p>
                  Seu catálogo está vazio.
                  <br />
                  Digite acima um produto que você costuma comprar e toque em Adicionar.
                </p>
              </div>
            ) : catalogoFiltrado.length === 0 ? (
              <div className="catalogo-vazio">
                <p>
                  Nenhum produto com “{nomeNovoCatalogo}”.
                  <br />
                  Toque em <strong>Adicionar</strong> para incluí-lo no catálogo.
                </p>
              </div>
            ) : (
              <>
                <div className="catalogo-topo">
                  <span>
                    {catalogoOrdenado.length} {catalogoOrdenado.length === 1 ? "produto" : "produtos"} no catálogo
                  </span>
                  <button
                    type="button"
                    className={`botao-selecionar ${modoSelecaoCatalogo ? "botao-selecionar-ativo" : ""}`}
                    onClick={alternarModoSelecaoCatalogo}
                  >
                    {modoSelecaoCatalogo ? (
                      <>
                        <X size={16} strokeWidth={2} /> Cancelar
                      </>
                    ) : (
                      <>
                        <SquareCheck size={16} strokeWidth={1.75} /> Selecionar
                      </>
                    )}
                  </button>
                </div>
                {modoSelecaoCatalogo && (
                  <div className="barra-selecao-produtos catalogo-selecionar-todos">
                    <label className="selecionar-todos">
                      <input
                        type="checkbox"
                        checked={todosCatalogoSelecionados}
                        onChange={alternarSelecaoTodosCatalogo}
                      />
                      {buscaCatalogo.trim()
                        ? `Selecionar os encontrados (${catalogoFiltrado.length})`
                        : `Selecionar todos (${catalogoFiltrado.length})`}
                    </label>
                  </div>
                )}
                <div className="catalogo-lista">
                  {catalogoFiltrado.map((item) => {
                    const jaNaLista = estaNaListaAtual(item);
                    const selecionado = selecionadosCatalogo.includes(item);
                    return (
                      <div
                        key={item}
                        className={`catalogo-item ${jaNaLista ? "catalogo-item-bloqueado" : ""} ${selecionado ? "catalogo-item-selecionado" : ""}`}
                      >
                        {itemEditandoCatalogo === item ? (
                          <>
                            <input
                              type="text"
                              value={nomeEditadoCatalogo}
                              onChange={(e) => setNomeEditadoCatalogo(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarEdicaoCatalogo();
                                if (e.key === "Escape") {
                                  e.stopPropagation();
                                  setItemEditandoCatalogo(null);
                                }
                              }}
                              autoFocus
                            />
                            <button
                              className="catalogo-acao"
                              onClick={salvarEdicaoCatalogo}
                              aria-label="Salvar nome"
                            >
                              <Check size={18} strokeWidth={2} />
                            </button>
                            <button
                              className="catalogo-acao"
                              onClick={() => {
                                setItemEditandoCatalogo(null);
                                setNomeEditadoCatalogo("");
                                setErroCatalogo("");
                              }}
                              aria-label="Cancelar edição"
                            >
                              <X size={18} strokeWidth={1.75} />
                            </button>
                          </>
                        ) : (
                          <>
                            <label className="catalogo-item-rotulo">
                              <input
                                type="checkbox"
                                checked={selecionado}
                                disabled={jaNaLista && !modoSelecaoCatalogo}
                                onChange={() => alternarSelecaoCatalogo(item)}
                              />
                              <span>{item}</span>
                            </label>
                            {jaNaLista && <em className="catalogo-tag">na lista</em>}
                            {!modoSelecaoCatalogo && (
                              <>
                                <button
                                  className="catalogo-acao"
                                  onClick={() => {
                                    setItemEditandoCatalogo(item);
                                    setNomeEditadoCatalogo(item);
                                    setErroCatalogo("");
                                  }}
                                  aria-label={`Editar ${item}`}
                                >
                                  <Pencil size={16} strokeWidth={1.75} />
                                </button>
                                <button
                                  className="catalogo-acao catalogo-acao-perigo"
                                  onClick={() => removerDoCatalogo(item)}
                                  aria-label={`Remover ${item} do catálogo`}
                                >
                                  <Trash2 size={16} strokeWidth={1.75} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {modoSelecaoCatalogo && (
              <div className="catalogo-barra-selecao">
                <span>
                  <strong>{selecionadosCatalogo.length}</strong>{" "}
                  {selecionadosCatalogo.length === 1 ? "selecionado" : "selecionados"}
                </span>
                <button
                  type="button"
                  className="botao-excluir-selecionados"
                  onClick={() => {
                    setErroCatalogo("");
                    setMostrarConfirmarExclusaoCatalogo(true);
                  }}
                  disabled={selecionadosCatalogo.length === 0}
                >
                  <Trash2 size={18} strokeWidth={1.75} />
                  Excluir
                </button>
              </div>
            )}

            {!modoSelecaoCatalogo && selecionadosCatalogo.length > 0 && (
              <button
                className="botao-adicionar-selecionados"
                onClick={adicionarSelecionadosALista}
                disabled={adicionandoSelecionados}
              >
                {adicionandoSelecionados ? (
                  "Adicionando..."
                ) : (
                  <>
                    <Plus size={18} strokeWidth={2} />
                    Adicionar {selecionadosCatalogo.length} à lista
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {mostrarConfirmarExclusaoCatalogo && (
        <div
          className="modal-fundo"
          onClick={() => !excluindoDoCatalogo && setMostrarConfirmarExclusaoCatalogo(false)}
        >
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-circulo icone-circulo-perigo">
              <Trash2 size={26} strokeWidth={1.75} />
            </div>
            <h2>
              Excluir {selecionadosCatalogo.length}{" "}
              {selecionadosCatalogo.length === 1 ? "produto" : "produtos"} do catálogo?
            </h2>
            <p>Eles saem só do catálogo; a lista de compras não muda.</p>
            <div className="botoes-confirmacao">
              <button
                className="botao-cancelar"
                onClick={() => setMostrarConfirmarExclusaoCatalogo(false)}
                disabled={excluindoDoCatalogo}
              >
                Cancelar
              </button>
              <button
                className="botao-confirmar-exclusao"
                onClick={excluirSelecionadosDoCatalogo}
                disabled={excluindoDoCatalogo}
              >
                {excluindoDoCatalogo ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmarSair && (
        <div className="modal-fundo" onClick={() => !saindoDaLista && setMostrarConfirmarSair(false)}>
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-circulo icone-circulo-perigo">
              <DoorOpen size={26} strokeWidth={1.75} />
            </div>
            <h2>Sair desta lista?</h2>
            <p>
              Você vai deixar de ver e editar os produtos desta lista e voltará para a sua
              lista pessoal.
            </p>
            {erroSairLista && <div className="erro-compartilhamento">{erroSairLista}</div>}
            <div className="botoes-confirmacao">
              <button
                className="botao-cancelar"
                onClick={() => setMostrarConfirmarSair(false)}
                disabled={saindoDaLista}
              >
                Cancelar
              </button>
              <button
                className="botao-confirmar-saida"
                onClick={sairDaListaCompartilhada}
                disabled={saindoDaLista}
              >
                {saindoDaLista ? "Saindo..." : "Sair da lista"}
              </button>
            </div>
          </div>
        </div>
      )}

      {avisoPerdaAcesso && (
        <div className="modal-fundo">
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-circulo icone-circulo-perigo">
              <DoorOpen size={26} strokeWidth={1.75} />
            </div>
            <h2>Você saiu da lista compartilhada</h2>
            <p>
              O dono parou de compartilhar esta lista. Você voltou para a sua lista pessoal e
              pode continuar usando normalmente.
            </p>
            <div className="botoes-confirmacao unico">
              <button className="botao-ok-aviso" onClick={() => setAvisoPerdaAcesso(false)}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmarParar && (
        <div
          className="modal-fundo"
          onClick={() => !parandoCompartilhamento && setMostrarConfirmarParar(false)}
        >
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-circulo icone-circulo-perigo">
              <DoorOpen size={26} strokeWidth={1.75} />
            </div>
            <h2>Parar de compartilhar?</h2>
            <p>
              As outras pessoas perderão o acesso a esta lista imediatamente. Um novo código
              será gerado e o antigo deixará de funcionar.
            </p>
            {erroPararCompartilhar && (
              <div className="erro-compartilhamento">{erroPararCompartilhar}</div>
            )}
            <div className="botoes-confirmacao">
              <button
                className="botao-cancelar"
                onClick={() => setMostrarConfirmarParar(false)}
                disabled={parandoCompartilhamento}
              >
                Cancelar
              </button>
              <button
                className="botao-confirmar-saida"
                onClick={pararDeCompartilhar}
                disabled={parandoCompartilhamento}
              >
                {parandoCompartilhamento ? "Parando..." : "Parar de compartilhar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarFormulario && (
        <div className="modal-fundo" onClick={fecharFormulario}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cabecalho">
              <div>
                <h2>{idProdutoEditando ? "Editar produto" : "Adicionar produto"}</h2>
                <p>{idProdutoEditando ? "Altere as informações" : "Preencha as informações"}</p>
              </div>
              <button className="fechar" onClick={fecharFormulario} aria-label="Fechar">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={salvarProduto} noValidate>
              <label htmlFor="nome-produto">Nome do produto</label>
              <input
                id="nome-produto"
                type="text"
                name="nome"
                placeholder="Ex: Arroz"
                list="sugestoes-catalogo"
                autoComplete="off"
                value={novoProduto.nome}
                onChange={alterarCampo}
              />
              {/* Sugere os itens do catálogo enquanto digita */}
              <datalist id="sugestoes-catalogo">
                {catalogoOrdenado.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>

              <div className="linha">
                <div>
                  <label htmlFor="quantidade-produto">Quantidade</label>
                  <input
                    id="quantidade-produto"
                    type="number"
                    name="quantidade"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={novoProduto.quantidade}
                    onChange={alterarCampo}
                  />
                </div>
                <div>
                  <label htmlFor="unidade-produto">Unidade</label>
                  <select
                    id="unidade-produto"
                    name="unidade"
                    value={novoProduto.unidade}
                    onChange={alterarCampo}
                  >
                    {UNIDADES.map((u) => (
                      <option key={u} value={u}>
                        {rotuloUnidade(u)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="comparacao-opcional">
                <div>
                  <strong>Mercados do produto</strong>
                  <span>Selecione um ou mais mercados; informar o preço é opcional.</span>
                </div>
                <button
                  type="button"
                  className={`switch-comparacao ${compararPrecos ? "ativo" : ""}`}
                  onClick={alternarComparacao}
                  aria-pressed={compararPrecos}
                  aria-label="Informar mercados do produto"
                >
                  <span />
                </button>
              </div>

              {compararPrecos &&
                novoProduto.mercados.map((mercado, index) => {
                  const totalMercado =
                    temPreco(mercado.preco) && Number(novoProduto.quantidade) > 0
                      ? Number(mercado.preco) * Number(novoProduto.quantidade)
                      : null;
                  // "Outro" escolhido com nome em branco (e preço digitado ou já tentou salvar)
                  const nomeOutroFaltando =
                    mercado.outro &&
                    !(mercado.local || "").trim() &&
                    (temPreco(mercado.preco) || tentouSalvar);
                  return (
                    <div className="linha-mercado" key={index}>
                      <div>
                        <label>Mercado {index + 1}</label>
                        <select
                          value={mercado.outro ? "Outro" : mercado.local}
                          onChange={(e) => escolherMercado(index, e.target.value)}
                        >
                          <option value="">Selecione</option>
                          {MERCADOS.map((nome) => (
                            <option key={nome} value={nome}>
                              {nome}
                            </option>
                          ))}
                          <option value="Outro">Outro...</option>
                        </select>
                      </div>
                      <div>
                        <label>Preço unitário</label>
                        <input
                          type="number"
                          placeholder="Ex: 5.99"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          value={mercado.preco}
                          onChange={(e) => alterarCampoMercado(index, "preco", e.target.value)}
                        />
                      </div>
                      {mercado.outro && (
                        <div className="campo-mercado-outro">
                          <label>Nome do mercado</label>
                          <input
                            id={`nome-mercado-${index}`}
                            type="text"
                            placeholder="Ex: Mercado do bairro"
                            value={mercado.local}
                            onChange={(e) => alterarCampoMercado(index, "local", e.target.value)}
                            aria-invalid={nomeOutroFaltando}
                            aria-describedby={
                              nomeOutroFaltando ? `erro-nome-mercado-${index}` : undefined
                            }
                          />
                          {nomeOutroFaltando && (
                            <p className="erro-campo" id={`erro-nome-mercado-${index}`} role="alert">
                              Por favor, preencha o nome.
                            </p>
                          )}
                        </div>
                      )}
                      {novoProduto.mercados.length > 1 && (
                        <button
                          type="button"
                          className="botao-remover-mercado"
                          onClick={() => removerMercado(index)}
                          aria-label={`Remover mercado ${index + 1}`}
                        >
                          <X size={18} strokeWidth={1.75} />
                        </button>
                      )}
                      {totalMercado !== null && (
                        <div className="preview-total-mercado">
                          <span>Total neste mercado</span>
                          <strong>{formatarPreco(totalMercado)}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}

              {compararPrecos && (
                <button type="button" className="botao-add-mercado" onClick={adicionarMercado}>
                  <Plus size={18} strokeWidth={2} />
                  Adicionar outro mercado
                </button>
              )}

              {erroFormulario && (
                <div className="erro-formulario" role="alert">
                  {erroFormulario}
                </div>
              )}

              <button type="submit" className="salvar" disabled={salvandoProduto}>
                {salvandoProduto
                  ? "Salvando..."
                  : idProdutoEditando
                    ? "Salvar alterações"
                    : "Adicionar à lista"}
              </button>
            </form>
          </div>
        </div>
      )}

      {produtoAberto && !mostrarFormulario && (
        <div className="modal-fundo modal-fundo-folha" onClick={() => setIdProdutoAberto(null)}>
          <div className="modal-acoes" onClick={(e) => e.stopPropagation()}>
            <div className="folha-alca" aria-hidden="true" />
            <div className="acoes-produto">
              <div>
                <h2>{produtoAberto.nome}</h2>
                <p>{textoQuantidade(produtoAberto)}</p>
              </div>
              <button className="fechar" onClick={() => setIdProdutoAberto(null)} aria-label="Fechar">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <TabelaMercados produto={produtoAberto} />

            <button
              className={`botao-primario botao-grande ${produtoAberto.comprado ? "botao-desmarcar" : ""}`}
              onClick={async () => {
                await alternarComprado(produtoAberto.id);
                setIdProdutoAberto(null);
              }}
            >
              {produtoAberto.comprado ? (
                <>
                  <Undo2 size={18} strokeWidth={1.75} /> Desmarcar como pego
                </>
              ) : (
                <>
                  <Check size={18} strokeWidth={2} /> Marcar como pego
                </>
              )}
            </button>
            <div className="acoes-secundarias">
              <button className="botao-secundario" onClick={() => iniciarEdicao(produtoAberto)}>
                <Pencil size={16} strokeWidth={1.75} /> Editar
              </button>
              <button
                className="botao-secundario botao-texto-perigo"
                onClick={() => setProdutoParaExcluir(produtoAberto)}
              >
                <Trash2 size={16} strokeWidth={1.75} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {produtoParaExcluir && (
        <div className="modal-fundo" onClick={() => setProdutoParaExcluir(null)}>
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-circulo icone-circulo-perigo">
              <Trash2 size={26} strokeWidth={1.75} />
            </div>
            <h2>Deseja excluir este produto?</h2>
            <p>
              <strong>{produtoParaExcluir.nome}</strong> será removido da lista.
            </p>
            <div className="botoes-confirmacao">
              <button className="botao-cancelar" onClick={() => setProdutoParaExcluir(null)}>
                Cancelar
              </button>
              <button className="botao-confirmar-exclusao" onClick={confirmarExclusao}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmarExclusaoLote && (
        <div
          className="modal-fundo"
          onClick={() => !excluindoSelecionados && setMostrarConfirmarExclusaoLote(false)}
        >
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-circulo icone-circulo-perigo">
              <Trash2 size={26} strokeWidth={1.75} />
            </div>
            <h2>
              Excluir {qtdSelecionados} {qtdSelecionados === 1 ? "produto" : "produtos"}?
            </h2>
            <p>Essa ação não pode ser desfeita.</p>
            {erroExclusaoLote && <div className="erro-compartilhamento">{erroExclusaoLote}</div>}
            <div className="botoes-confirmacao">
              <button
                className="botao-cancelar"
                onClick={() => setMostrarConfirmarExclusaoLote(false)}
                disabled={excluindoSelecionados}
              >
                Cancelar
              </button>
              <button
                className="botao-confirmar-exclusao"
                onClick={excluirProdutosSelecionados}
                disabled={excluindoSelecionados}
              >
                {excluindoSelecionados ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;