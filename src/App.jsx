import logoCarrinho from "./assets/logo-carrinho.png";
import { useEffect, useState, useMemo } from "react";
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
} from "firebase/firestore";
import { db, auth } from "./firebase";
import Login from "./Login";
import "./App.css";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [reenviando, setReenviando] = useState(false);

  const [listaId, setListaId] = useState(null);
  const [codigoCompartilhamento, setCodigoCompartilhamento] = useState("");
  const [donoIdLista, setDonoIdLista] = useState(null);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [membrosLista, setMembrosLista] = useState([]);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [produtoParaExcluir, setProdutoParaExcluir] = useState(null);
  const [compararPrecos, setCompararPrecos] = useState(false);

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

  const [catalogo, setCatalogo] = useState([]);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [novoItemCatalogo, setNovoItemCatalogo] = useState("");
  const [itemEditandoCatalogo, setItemEditandoCatalogo] = useState(null);
  const [nomeEditadoCatalogo, setNomeEditadoCatalogo] = useState("");
  const [erroCatalogo, setErroCatalogo] = useState("");
  const [selecionadosCatalogo, setSelecionadosCatalogo] = useState([]);
  const [adicionandoSelecionados, setAdicionandoSelecionados] = useState(false);

  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    quantidade: 1,
    unidade: "unidade(s)",
    mercados: [
      { local: "", preco: "" },
      { local: "", preco: "" },
    ],
  });

  useEffect(() => {
    const cancelar = onAuthStateChanged(auth, (usuarioAtual) => {
      setUsuario(usuarioAtual);
      setCarregando(false);
    });
    return () => cancelar();
  }, []);

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

  function gerarCodigoCompartilhamento() {
    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let codigo = "";
    for (let i = 0; i < 6; i++) {
      codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    return codigo;
  }

  async function prepararLista() {
    if (!usuario) {
      setListaId(null);
      setProdutos([]);
      setCodigoCompartilhamento("");
      setDonoIdLista(null);
      setCatalogo([]);
      setCarregandoLista(false);
      return;
    }

    setCarregandoLista(true);

    try {
      const usuarioRef = doc(db, "usuarios", usuario.uid);
      const usuarioSnapshot = await getDoc(usuarioRef);

      let idDaLista = null;

      if (usuarioSnapshot.exists()) {
        const dadosUsuario = usuarioSnapshot.data();
        setCatalogo(dadosUsuario.catalogo || []);
        if (dadosUsuario.listaId) {
          idDaLista = dadosUsuario.listaId;
        }
      } else {
        setCatalogo([]);
      }

      if (!idDaLista) {
        const novaListaRef = doc(collection(db, "listas"));
        idDaLista = novaListaRef.id;
        const codigo = gerarCodigoCompartilhamento();

        await setDoc(novaListaRef, {
          donoId: usuario.uid,
          criadoEm: new Date(),
          codigoCompartilhamento: codigo,
          membros: [usuario.uid],
        });

        await setDoc(usuarioRef, { listaId: idDaLista, email: usuario.email }, { merge: true });
        await setDoc(doc(db, "codigosCompartilhamento", codigo), { listaId: idDaLista });

        setCodigoCompartilhamento(codigo);
        setDonoIdLista(usuario.uid);
      }

      setListaId(idDaLista);

      const listaRef = doc(db, "listas", idDaLista);
      const listaSnapshot = await getDoc(listaRef);

      if (!listaSnapshot.exists()) {
        console.error("A lista salva para o usuário não existe.");
        await setDoc(usuarioRef, { listaId: "" }, { merge: true });
        setListaId(null);
        setCodigoCompartilhamento("");
        setDonoIdLista(null);
        return;
      }

      const dadosLista = listaSnapshot.data();
      setDonoIdLista(dadosLista.donoId);

      let codigoFinal = dadosLista.codigoCompartilhamento;
      if (!codigoFinal) {
        codigoFinal = gerarCodigoCompartilhamento();
        await updateDoc(listaRef, { codigoCompartilhamento: codigoFinal });
        await setDoc(doc(db, "codigosCompartilhamento", codigoFinal), { listaId: idDaLista });
      }

      const codigoRef = doc(db, "codigosCompartilhamento", codigoFinal);
      const codigoSnapshot = await getDoc(codigoRef);
      if (!codigoSnapshot.exists()) {
        await setDoc(codigoRef, { listaId: idDaLista });
      }

      setCodigoCompartilhamento(codigoFinal);
    } catch (erro) {
      console.error("Erro ao preparar lista:", erro);
    } finally {
      setCarregandoLista(false);
    }
  }

  async function tratarPerdaDeAcesso() {
    if (!usuario) return;
    setAvisoPerdaAcesso(true);
    setProdutos([]);
    setMembrosLista([]);
    setCodigoCompartilhamento("");
    setDonoIdLista(null);
    setListaId(null);
    try {
      await setDoc(doc(db, "usuarios", usuario.uid), { listaId: "" }, { merge: true });
    } catch (erro) {
      console.error("Erro ao limpar lista do usuario:", erro);
    }
    await prepararLista();
  }

  useEffect(() => {
    prepararLista();
  }, [usuario]);

  const handleReenviarVerificacao = async () => {
    if (!usuario) return;
    setReenviando(true);
    try {
      await sendEmailVerification(usuario);
      alert("E-mail de verificação reenviado! Verifique sua caixa de entrada.");
    } catch (error) {
      alert("Erro ao reenviar. Tente novamente.");
    } finally {
      setReenviando(false);
    }
  };

  const handleOkVerificacao = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    }
  };

  useEffect(() => {
    if (!usuario || !listaId) {
      setProdutos([]);
      return;
    }

    const produtosRef = collection(db, "listas", listaId, "produtos");
    const cancelar = onSnapshot(
      produtosRef,
      (snapshot) => {
        const produtosFirebase = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProdutos(produtosFirebase);
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

    const listaRef = doc(db, "listas", listaId);
    const cancelar = onSnapshot(
      listaRef,
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

  const catalogoOrdenado = useMemo(
    () =>
      [...catalogo].sort((a, b) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" })
      ),
    [catalogo]
  );

  const produtosOrdenados = useMemo(
    () =>
      [...produtos].sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" })
      ),
    [produtos]
  );

  function obterMercados(produto) {
    if (produto.mercados && produto.mercados.length) return produto.mercados;
    if (produto.local) return [{ local: produto.local, preco: produto.preco }];
    return [];
  }

  function obterMercadosComPreco(produto) {
    return obterMercados(produto).filter(
      (m) => m.local && m.preco !== "" && Number.isFinite(Number(m.preco))
    );
  }

  function alterarCampo(e) {
    const { name, value } = e.target;
    setNovoProduto((atual) => ({ ...atual, [name]: value }));
  }

  function alterarCampoMercado(index, campo, valor) {
    setNovoProduto((atual) => {
      const mercados = [...atual.mercados];
      mercados[index] = { ...mercados[index], [campo]: valor };
      return { ...atual, mercados };
    });
  }

  function adicionarMercado() {
    setNovoProduto((atual) => ({
      ...atual,
      mercados: [...atual.mercados, { local: "", preco: "" }],
    }));
  }

  function removerMercado(index) {
    setNovoProduto((atual) => ({
      ...atual,
      mercados: atual.mercados.filter((_, i) => i !== index),
    }));
  }

  function abrirFormularioAdicionar() {
    setNovoProduto({
      nome: "",
      quantidade: 1,
      unidade: "unidade(s)",
      mercados: [],
    });
    setCompararPrecos(false);
    setProdutoSelecionado(null);
    setMostrarFormulario(true);
  }

  async function adicionarProduto(e) {
    e.preventDefault();
    if (!listaId) return alert("Sua lista ainda está sendo preparada.");

    const mercadosValidos = compararPrecos
      ? novoProduto.mercados
          .filter((m) => m.local && m.preco !== "")
          .map((m) => ({ local: m.local, preco: Number(m.preco) }))
      : [];

    if (!novoProduto.nome || !novoProduto.quantidade) {
      return alert("Preencha o nome e a quantidade.");
    }

    if (compararPrecos && mercadosValidos.length === 0) {
      return alert("Adicione ao menos um mercado com preço ou desative a comparação de preços.");
    }
    try {
      await addDoc(collection(db, "listas", listaId, "produtos"), {
        nome: novoProduto.nome,
        quantidade: Number(novoProduto.quantidade),
        unidade: novoProduto.unidade,
        mercados: mercadosValidos,
        comprado: false,
        criadoPor: usuario.uid,
      });
      setNovoProduto({
        nome: "",
        quantidade: 1,
        unidade: "unidade(s)",
        mercados: [],
      });
      setCompararPrecos(false);
      setMostrarFormulario(false);
    } catch (erro) {
      alert("Erro ao adicionar produto.");
    }
  }

  function iniciarEdicao(produto) {
    const mercados = obterMercados(produto);
    setCompararPrecos(mercados.length > 0);
    setNovoProduto({
      nome: produto.nome,
      quantidade: produto.quantidade,
      unidade: normalizarUnidade(produto.unidade),
      mercados: mercados.length
        ? mercados.map((m) => ({ local: m.local || "", preco: m.preco !== undefined ? String(m.preco) : "" }))
        : [],
    });
    setProdutoSelecionado(produto);
    setMostrarFormulario(true);
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    if (!produtoSelecionado || !listaId) return;

    const mercadosValidos = compararPrecos
      ? novoProduto.mercados
          .filter((m) => m.local && m.preco !== "")
          .map((m) => ({ local: m.local, preco: Number(m.preco) }))
      : [];

    if (!novoProduto.nome || !novoProduto.quantidade) {
      return alert("Preencha o nome e a quantidade.");
    }

    if (compararPrecos && mercadosValidos.length === 0) {
      return alert("Adicione ao menos um mercado com preço ou desative a comparação de preços.");
    }
    try {
      const ref = doc(db, "listas", listaId, "produtos", produtoSelecionado.id);
      await updateDoc(ref, {
        nome: novoProduto.nome,
        quantidade: Number(novoProduto.quantidade),
        unidade: novoProduto.unidade,
        mercados: mercadosValidos,
      });
      setNovoProduto({
        nome: "",
        quantidade: 1,
        unidade: "unidade(s)",
        mercados: [],
      });
      setCompararPrecos(false);
      setProdutoSelecionado(null);
      setMostrarFormulario(false);
    } catch (erro) {
      alert("Erro ao salvar alterações.");
    }
  }

  async function alternarComprado(id) {
    if (!listaId) return;
    const produto = produtos.find((p) => p.id === id);
    if (!produto) return;
    try {
      const ref = doc(db, "listas", listaId, "produtos", id);
      await updateDoc(ref, { comprado: !produto.comprado });
    } catch (erro) {
      alert("Erro ao marcar produto.");
    }
  }

  function pedirExclusao(produto) {
    setProdutoParaExcluir(produto);
  }

  async function confirmarExclusao() {
    if (!produtoParaExcluir || !listaId) return;
    try {
      const ref = doc(db, "listas", listaId, "produtos", produtoParaExcluir.id);
      await deleteDoc(ref);
      setProdutoParaExcluir(null);
      setProdutoSelecionado(null);
    } catch (erro) {
      alert("Erro ao excluir produto.");
    }
  }

  async function abrirCompartilhamento() {
    try {
      setErroCompartilhamento("");
      setCodigoCopiado(false);
      if (!codigoCompartilhamento && listaId) {
        const listaRef = doc(db, "listas", listaId);
        const snap = await getDoc(listaRef);
        if (snap.exists()) {
          const data = snap.data();
          let codigo = data.codigoCompartilhamento;
          if (!codigo) {
            codigo = gerarCodigoCompartilhamento();
            await updateDoc(listaRef, { codigoCompartilhamento: codigo });
          }
          await setDoc(doc(db, "codigosCompartilhamento", codigo), { listaId });
          setCodigoCompartilhamento(codigo);
        }
      }
      setMostrarCompartilhar(true);
    } catch (erro) {
      setErroCompartilhamento("Erro ao carregar código.");
      setMostrarCompartilhar(true);
    }
  }

  async function entrarEmLista() {
    const codigo = codigoDigitado.trim().toUpperCase();
    if (!codigo) return setErroCompartilhamento("Digite o código.");
    if (!usuario) return setErroCompartilhamento("Faça login primeiro.");
    try {
      setCarregandoCompartilhamento(true);
      setErroCompartilhamento("");

      const codigoRef = doc(db, "codigosCompartilhamento", codigo);
      const snap = await getDoc(codigoRef);
      if (!snap.exists()) return setErroCompartilhamento("Código inválido.");
      const novaListaId = snap.data().listaId;
      if (!novaListaId) return setErroCompartilhamento("Lista não encontrada.");

      const listaRef = doc(db, "listas", novaListaId);
      const listaSnap = await getDoc(listaRef);
      if (!listaSnap.exists()) return setErroCompartilhamento("Lista não existe.");
      const dadosLista = listaSnap.data();

      await updateDoc(listaRef, { membros: arrayUnion(usuario.uid) });

      const usuarioRef = doc(db, "usuarios", usuario.uid);
      await setDoc(usuarioRef, { listaId: novaListaId, email: usuario.email }, { merge: true });

      setListaId(novaListaId);
      setCodigoCompartilhamento(dadosLista.codigoCompartilhamento || codigo);
      setDonoIdLista(dadosLista.donoId);
      setCodigoDigitado("");
      setProdutos([]);
      setEntrouComSucesso(true);
      setTimeout(() => {
        setMostrarEntrarLista(false);
        setEntrouComSucesso(false);
      }, 1500);
    } catch (erro) {
      setErroCompartilhamento("Erro ao entrar.");
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
    try {
      setSaindoDaLista(true);
      setErroSairLista("");
      const listaRef = doc(db, "listas", listaId);
      await updateDoc(listaRef, { membros: arrayRemove(usuario.uid) });
      const usuarioRef = doc(db, "usuarios", usuario.uid);
      await setDoc(usuarioRef, { listaId: "" }, { merge: true });
      setListaId(null);
      setCodigoCompartilhamento("");
      setDonoIdLista(null);
      setProdutos([]);
      setMostrarConfirmarSair(false);
      await prepararLista();
    } catch (erro) {
      setErroSairLista("Erro ao sair.");
    } finally {
      setSaindoDaLista(false);
    }
  }

  async function pararDeCompartilhar() {
    if (!listaId || !usuario) return;
    try {
      setParandoCompartilhamento(true);
      setErroPararCompartilhar("");

      const codigoAntigo = codigoCompartilhamento;
      const novoCodigo = gerarCodigoCompartilhamento();
      const listaRef = doc(db, "listas", listaId);

      await updateDoc(listaRef, {
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
      setErroPararCompartilhar("Erro ao parar de compartilhar.");
    } finally {
      setParandoCompartilhamento(false);
    }
  }

  async function salvarCatalogo(novoCatalogo) {
    if (!usuario) return;
    await setDoc(doc(db, "usuarios", usuario.uid), { catalogo: novoCatalogo }, { merge: true });
    setCatalogo(novoCatalogo);
  }

  function existeNoCatalogo(nome, ignorar) {
    return catalogo.some(
      (item) =>
        item !== ignorar &&
        item.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0
    );
  }

  async function adicionarAoCatalogo() {
    const nome = novoItemCatalogo.trim();
    if (!nome) return setErroCatalogo("Digite o nome do produto.");
    if (existeNoCatalogo(nome, null)) return setErroCatalogo("Esse produto já está no catálogo.");
    try {
      setErroCatalogo("");
      await salvarCatalogo([...catalogo, nome]);
      setNovoItemCatalogo("");
    } catch (erro) {
      setErroCatalogo("Erro ao adicionar ao catálogo.");
    }
  }

  async function salvarEdicaoCatalogo() {
    const nome = nomeEditadoCatalogo.trim();
    if (!nome) return setErroCatalogo("Digite o nome do produto.");
    if (existeNoCatalogo(nome, itemEditandoCatalogo)) {
      return setErroCatalogo("Esse produto já está no catálogo.");
    }
    try {
      setErroCatalogo("");
      await salvarCatalogo(catalogo.map((item) => (item === itemEditandoCatalogo ? nome : item)));
      setItemEditandoCatalogo(null);
      setNomeEditadoCatalogo("");
    } catch (erro) {
      setErroCatalogo("Erro ao salvar alteração.");
    }
  }

  async function removerDoCatalogo(item) {
    try {
      setErroCatalogo("");
      await salvarCatalogo(catalogo.filter((i) => i !== item));
    } catch (erro) {
      setErroCatalogo("Erro ao remover do catálogo.");
    }
  }

  function estaNaListaAtual(nome) {
    return produtos.some(
      (p) => (p.nome || "").localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0
    );
  }

  function alternarSelecaoCatalogo(item) {
    setErroCatalogo("");
    setSelecionadosCatalogo((atual) =>
      atual.includes(item) ? atual.filter((i) => i !== item) : [...atual, item]
    );
  }

  async function adicionarSelecionadosALista() {
    if (!listaId || selecionadosCatalogo.length === 0) return;
    try {
      setAdicionandoSelecionados(true);
      setErroCatalogo("");
      for (const nome of selecionadosCatalogo) {
        await addDoc(collection(db, "listas", listaId, "produtos"), {
          nome,
          quantidade: 1,
          unidade: "unidade(s)",
          mercados: [],
          comprado: false,
          criadoPor: usuario.uid,
        });
      }
      fecharCatalogo();
    } catch (erro) {
      setErroCatalogo("Erro ao adicionar os produtos à lista.");
    } finally {
      setAdicionandoSelecionados(false);
    }
  }

  function fecharCatalogo() {
    setMostrarCatalogo(false);
    setNovoItemCatalogo("");
    setItemEditandoCatalogo(null);
    setNomeEditadoCatalogo("");
    setErroCatalogo("");
    setSelecionadosCatalogo([]);
  }

  function formatarPreco(valor) {
    return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

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

  if (!usuario.emailVerified) {
    return (
      <div className="tela-verificacao-card">
        <div className="card-verificacao">
          <div className="icone-email">📧</div>
          <h2>Verifique seu e-mail</h2>
          <p>
            Enviamos um link de confirmação para <strong>{usuario.email}</strong>.
            <br />
            Clique nele para ativar sua conta e depois faça login novamente.
          </p>
          <div className="botoes-verificacao">
            <button
              className="botao-reenviar-verificacao"
              onClick={handleReenviarVerificacao}
              disabled={reenviando}
            >
              {reenviando ? "Enviando..." : "Reenviar e-mail de verificação"}
            </button>
            <button className="botao-ok-verificacao" onClick={handleOkVerificacao}>
              Ok
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

  const totalGeral = produtos.reduce((total, p) => {
    const mercados = obterMercadosComPreco(p);
    const precos = mercados.map((m) => Number(m.preco));
    const menor = precos.length ? Math.min(...precos) : 0;
    return total + menor * Number(p.quantidade);
  }, 0);

  const temPrecos = produtos.some((p) => obterMercadosComPreco(p).length > 0);
  const produtosComprados = produtos.filter((p) => p.comprado).length;
  const produtosRestantes = produtos.length - produtosComprados;
  const progresso = produtos.length > 0 ? (produtosComprados / produtos.length) * 100 : 0;
  const ehListaPropria = !donoIdLista || donoIdLista === usuario.uid;
  const estaCompartilhando = membrosLista.length > 1;

  return (
    <div className="app">
      <header className="header">
        <div className="logo-area">
          <div className="logo">
  <img src={logoCarrinho} alt="Lista de Compras" />
          </div>
          <div>
            <h1>Lista de Compras</h1>
            <p>{usuario.email}</p>
          </div>
        </div>

        <div className="acoes-header">
          <button className="botao-compartilhar" onClick={abrirCompartilhamento}>
            🔗 Compartilhar
          </button>
          {ehListaPropria && !estaCompartilhando && (
            <button
              className="botao-entrar-lista"
              onClick={() => {
                setErroCompartilhamento("");
                setEntrouComSucesso(false);
                setMostrarEntrarLista(true);
              }}
            >
              📋 Entrar em lista
            </button>
          )}
          {ehListaPropria && estaCompartilhando && (
            <button
              className="botao-sair-lista"
              onClick={() => {
                setErroPararCompartilhar("");
                setMostrarConfirmarParar(true);
              }}
            >
              🚪 Parar de compartilhar lista
            </button>
          )}
          {!ehListaPropria && (
            <button
              className="botao-sair-lista"
              onClick={() => {
                setErroSairLista("");
                setMostrarConfirmarSair(true);
              }}
            >
              🚪 Sair da lista
            </button>
          )}
          <button
            className="botao-catalogo"
            onClick={() => {
              setErroCatalogo("");
              setMostrarCatalogo(true);
            }}
          >
            📋 Catálogo
          </button>
          <button className="botao-adicionar" onClick={abrirFormularioAdicionar}>
            ＋ Adicionar
          </button>
          <button className="botao-sair" onClick={() => signOut(auth)}>
            Sair
          </button>
        </div>
      </header>

      <main className="conteudo">
        <section className="resumo">
          <div className="resumo-card">
            <span className="resumo-icone roxo">🛒</span>
            <div>
              <strong>{produtos.length}</strong>
              <span>Produtos</span>
            </div>
          </div>
          <div className="resumo-card">
            <span className="resumo-icone laranja">⏳</span>
            <div>
              <strong>{produtosRestantes}</strong>
              <span>Faltam</span>
            </div>
          </div>
          <div className="resumo-card">
            <span className="resumo-icone verde">✓</span>
            <div>
              <strong>{produtosComprados}</strong>
              <span>Pegos</span>
            </div>
          </div>
        </section>

        <section className="progresso-card">
          <div className="progresso-topo">
            <div>
              <span>Progresso da compra</span>
              <strong>{produtosComprados} de {produtos.length}</strong>
            </div>
            <div className="porcentagem">{Math.round(progresso)}%</div>
          </div>
          <div className="barra">
            <div className="barra-preenchida" style={{ width: `${progresso}%` }} />
          </div>
        </section>

        {temPrecos && (
          <section className="total-card">
            <div className="total-info">
              <span>Total da lista (itens com preço)</span>
              <strong>{formatarPreco(totalGeral)}</strong>
            </div>
            <div className="total-icon">💰</div>
          </section>
        )}

        {produtos.length === 0 ? (
          <section className="lista-vazia">
            <h2>Minha lista</h2>
            <p className="lista-vazia-subtitulo">Lista vazia</p>

            <div className="ilustracao-carrinho">
              <div className="brilho brilho-esquerdo">✦</div>
              <div className="brilho brilho-direito">✦</div>
              <div className="alca alca-esquerda"></div>
              <div className="alca alca-direita"></div>
              <div className="cesta">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>

            <p className="lista-vazia-texto">
              Adicione produtos para começar sua lista!
            </p>
          </section>
        ) : (
          <>
            <div className="titulo-lista">
              <h2>Minha lista</h2>
              <p>
                {produtosRestantes === 0
                  ? "Todos os produtos foram pegos"
                  : `${produtosRestantes} ${produtosRestantes === 1 ? "produto" : "produtos"} faltando`}
              </p>
            </div>

            <section className="lista">
          {produtosOrdenados.map((produto) => {
            const mercados = obterMercadosComPreco(produto);
            const precos = mercados.map((m) => Number(m.preco));
            const menorPreco = precos.length ? Math.min(...precos) : 0;
            return (
              <article
                key={produto.id}
                className={`produto-card ${produto.comprado ? "produto-comprado" : ""}`}
                onClick={() => setProdutoSelecionado(produto)}
              >
                <button
                  className={`check ${produto.comprado ? "check-ativo" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    alternarComprado(produto.id);
                  }}
                >
                  {produto.comprado && "✓"}
                </button>
                <div className="produto-info">
                  <h3>{produto.nome}</h3>
                  <p className="quantidade">
                    {produto.quantidade} {normalizarUnidade(produto.unidade)}
                  </p>

                  {mercados.length > 0 ? (
                    <div className="mercados-comparacao">
                      {mercados.map((m, i) => {
                        const totalMercado = Number(m.preco) * Number(produto.quantidade);
                        const ehMaisBarato = mercados.length > 1 && Number(m.preco) === menorPreco;
                        return (
                          <div
                            key={i}
                            className={`mercado-item ${ehMaisBarato ? "mercado-barato" : ""}`}
                          >
                            <div className="mercado-nome">📍 {m.local}</div>
                            <div className="mercado-precos">
                              <div>
                                <small>Un.</small>
                                <strong>{formatarPreco(m.preco)}</strong>
                              </div>
                              <div>
                                <small>Total</small>
                                <strong>{formatarPreco(totalMercado)}</strong>
                              </div>
                            </div>
                            {ehMaisBarato && <span className="selo-barato">✓ Mais barato</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="sem-preco">Sem preço informado</span>
                  )}
                </div>
                <span className="seta-card">›</span>
              </article>
            );
          })}
            </section>
          </>
        )}
      </main>

      {mostrarCompartilhar && (
        <div className="modal-fundo" onClick={() => setMostrarCompartilhar(false)}>
          <div className="modal-compartilhamento" onClick={(e) => e.stopPropagation()}>
            <button className="fechar" onClick={() => setMostrarCompartilhar(false)}>×</button>
            <div className="compartilhar-icone">🔗</div>
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
              {codigoCopiado ? "✓ Copiado!" : "📋 Copiar código"}
            </button>
            <div className="aviso-compartilhamento">
              <span>💡</span>
              <p>Todos que entrarem usando este código poderão visualizar, adicionar, editar, marcar e excluir produtos da lista.</p>
            </div>
          </div>
        </div>
      )}

      {mostrarEntrarLista && (
        <div className="modal-fundo" onClick={() => setMostrarEntrarLista(false)}>
          <div className="modal-compartilhamento" onClick={(e) => e.stopPropagation()}>
            <button className="fechar" onClick={() => setMostrarEntrarLista(false)}>×</button>
            {entrouComSucesso ? (
              <>
                <div className="sucesso-icone">✓</div>
                <h2>Você entrou na lista!</h2>
                <p>Agora você já pode ver e adicionar produtos.</p>
              </>
            ) : (
              <>
                <div className="compartilhar-icone">📋</div>
                <h2>Entrar em uma lista</h2>
                <p>Digite o código recebido.</p>
                <input
                  className="input-codigo"
                  type="text"
                  placeholder="Ex: ABC123"
                  maxLength="6"
                  value={codigoDigitado}
                  onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())}
                />
                {erroCompartilhamento && <div className="erro-compartilhamento">{erroCompartilhamento}</div>}
                <button className="botao-entrar" onClick={entrarEmLista} disabled={carregandoCompartilhamento}>
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
              <button className="fechar" onClick={fecharCatalogo}>×</button>
            </div>

            <div className="catalogo-form">
              <input
                type="text"
                placeholder="Ex: Arroz"
                value={novoItemCatalogo}
                onChange={(e) => setNovoItemCatalogo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarAoCatalogo()}
              />
              <button className="botao-adicionar" onClick={adicionarAoCatalogo}>
                Adicionar
              </button>
            </div>

            {erroCatalogo && <div className="erro-catalogo">{erroCatalogo}</div>}

            {catalogoOrdenado.length === 0 ? (
              <div className="catalogo-vazio">
                <p>
                  Seu catálogo está vazio.
                  <br />
                  Adicione os produtos que você costuma comprar.
                </p>
              </div>
            ) : (
              <div className="catalogo-lista">
                {catalogoOrdenado.map((item) => {
                  const jaNaLista = estaNaListaAtual(item);
                  return (
                  <div
                    className={`catalogo-item ${jaNaLista ? "catalogo-item-bloqueado" : ""} ${
                      selecionadosCatalogo.includes(item) ? "catalogo-item-selecionado" : ""
                    }`}
                    key={item}
                  >
                    {itemEditandoCatalogo === item ? (
                      <>
                        <input
                          type="text"
                          value={nomeEditadoCatalogo}
                          onChange={(e) => setNomeEditadoCatalogo(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && salvarEdicaoCatalogo()}
                          autoFocus
                        />
                        <button className="catalogo-acao" onClick={salvarEdicaoCatalogo}>
                          ✓
                        </button>
                        <button
                          className="catalogo-acao"
                          onClick={() => {
                            setItemEditandoCatalogo(null);
                            setNomeEditadoCatalogo("");
                            setErroCatalogo("");
                          }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          type="checkbox"
                          checked={selecionadosCatalogo.includes(item)}
                          disabled={jaNaLista}
                          onChange={() => alternarSelecaoCatalogo(item)}
                        />
                        <span>{item}</span>
                        {jaNaLista && <em className="catalogo-tag">na lista</em>}
                        <button
                          className="catalogo-acao"
                          onClick={() => {
                            setItemEditandoCatalogo(item);
                            setNomeEditadoCatalogo(item);
                            setErroCatalogo("");
                          }}
                        >
                          ✏️
                        </button>
                        <button className="catalogo-acao" onClick={() => removerDoCatalogo(item)}>
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {selecionadosCatalogo.length > 0 && (
              <button
                className="botao-adicionar-selecionados"
                onClick={adicionarSelecionadosALista}
                disabled={adicionandoSelecionados}
              >
                {adicionandoSelecionados
                  ? "Adicionando..."
                  : `＋ Adicionar ${selecionadosCatalogo.length} à lista`}
              </button>
            )}
          </div>
        </div>
      )}

      {mostrarConfirmarSair && (
        <div className="modal-fundo modal-confirmacao-fundo" onClick={() => !saindoDaLista && setMostrarConfirmarSair(false)}>
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-saida">🚪</div>
            <h2>Sair desta lista?</h2>
            <p>Você vai deixar de ver e editar os produtos desta lista compartilhada. Uma lista pessoal nova será criada.</p>
            {erroSairLista && <div className="erro-compartilhamento">{erroSairLista}</div>}
            <div className="botoes-confirmacao">
              <button className="botao-cancelar" onClick={() => setMostrarConfirmarSair(false)} disabled={saindoDaLista}>
                Cancelar
              </button>
              <button className="botao-confirmar-saida" onClick={sairDaListaCompartilhada} disabled={saindoDaLista}>
                {saindoDaLista ? "Saindo..." : "🚪 Sair da lista"}
              </button>
            </div>
          </div>
        </div>
      )}

      {avisoPerdaAcesso && (
        <div className="modal-fundo modal-confirmacao-fundo">
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-saida">🚪</div>
            <h2>Você saiu da lista compartilhada</h2>
            <p>O dono desta lista parou de compartilhá-la. Sua lista pessoal foi restaurada e você já pode voltar a usá-la normalmente.</p>
            <div className="botoes-confirmacao unico">
              <button className="botao-confirmar-saida" onClick={() => setAvisoPerdaAcesso(false)}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmarParar && (
        <div className="modal-fundo modal-confirmacao-fundo" onClick={() => !parandoCompartilhamento && setMostrarConfirmarParar(false)}>
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-saida">🚪</div>
            <h2>Parar de compartilhar?</h2>
            <p>As outras pessoas perderão o acesso a esta lista imediatamente. Um novo código será gerado, e o código antigo deixará de funcionar.</p>
            {erroPararCompartilhar && <div className="erro-compartilhamento">{erroPararCompartilhar}</div>}
            <div className="botoes-confirmacao">
              <button className="botao-cancelar" onClick={() => setMostrarConfirmarParar(false)} disabled={parandoCompartilhamento}>
                Cancelar
              </button>
              <button className="botao-confirmar-saida" onClick={pararDeCompartilhar} disabled={parandoCompartilhamento}>
                {parandoCompartilhamento ? "Parando..." : "🚪 Parar de compartilhar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarFormulario && (
        <div className="modal-fundo" onClick={() => { setMostrarFormulario(false); setProdutoSelecionado(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cabecalho">
              <div>
                <h2>{produtoSelecionado ? "Editar produto" : "Adicionar produto"}</h2>
                <p>{produtoSelecionado ? "Altere as informações" : "Preencha as informações"}</p>
              </div>
              <button className="fechar" onClick={() => { setMostrarFormulario(false); setProdutoSelecionado(null); }}>×</button>
            </div>
            <form onSubmit={produtoSelecionado ? salvarEdicao : adicionarProduto}>
              <label>Nome do produto</label>
              <input type="text" name="nome" placeholder="Ex: Arroz" value={novoProduto.nome} onChange={alterarCampo} />

              <div className="linha">
                <div>
                  <label>Quantidade</label>
                  <input type="number" name="quantidade" min="1" value={novoProduto.quantidade} onChange={alterarCampo} />
                </div>
                <div>
                  <label>Unidade</label>
                  <select name="unidade" value={novoProduto.unidade} onChange={alterarCampo}>
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
                  <strong>Comparar preços</strong>
                  <span>Adicione mercados e preços para encontrar a melhor opção.</span>
                </div>
                <button
                  type="button"
                  className={`switch-comparacao ${compararPrecos ? "ativo" : ""}`}
                  onClick={() => {
                    const novoEstado = !compararPrecos;
                    setCompararPrecos(novoEstado);
                    if (novoEstado && novoProduto.mercados.length === 0) {
                      setNovoProduto((atual) => ({
                        ...atual,
                        mercados: [{ local: "", preco: "" }],
                      }));
                    }
                  }}
                  aria-pressed={compararPrecos}
                >
                  <span />
                </button>
              </div>

              {compararPrecos && novoProduto.mercados.map((mercado, index) => {
                const totalMercado =
                  mercado.preco !== "" && novoProduto.quantidade
                    ? Number(mercado.preco) * Number(novoProduto.quantidade)
                    : null;
                return (
                  <div className="linha-mercado" key={index}>
                    <div>
                      <label>Mercado {index + 1}</label>
                      <select
                        value={mercado.local}
                        onChange={(e) => alterarCampoMercado(index, "local", e.target.value)}
                      >
                        <option value="">Selecione</option>
                        <option value="Tenda">Tenda</option>
                        <option value="Savegnago">Savegnago</option>
                        <option value="Atacadão">Atacadão</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label>Preço por item</label>
                      <input
                        type="number"
                        placeholder="Ex: 5.99"
                        step="0.01"
                        min="0"
                        value={mercado.preco}
                        onChange={(e) => alterarCampoMercado(index, "preco", e.target.value)}
                      />
                    </div>
                    {novoProduto.mercados.length > 1 && (
                      <button
                        type="button"
                        className="botao-remover-mercado"
                        onClick={() => removerMercado(index)}
                      >
                        ×
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
                  ＋ Adicionar outro mercado
                </button>
              )}

              <button type="submit" className="salvar">
                {produtoSelecionado ? "✓ Salvar alterações" : "＋ Adicionar à lista"}
              </button>
            </form>
          </div>
        </div>
      )}

      {produtoSelecionado && !mostrarFormulario && (
        <div className="modal-fundo" onClick={() => setProdutoSelecionado(null)}>
          <div className="modal-acoes" onClick={(e) => e.stopPropagation()}>
            <div className="acoes-produto">
              <div>
                <span className="acoes-label">PRODUTO</span>
                <h2>{produtoSelecionado.nome}</h2>
                <p>{produtoSelecionado.quantidade} {normalizarUnidade(produtoSelecionado.unidade)}</p>
              </div>
              <button className="fechar" onClick={() => setProdutoSelecionado(null)}>×</button>
            </div>

            {(() => {
              const mercados = obterMercadosComPreco(produtoSelecionado);
              const menor = mercados.length ? Math.min(...mercados.map((m) => Number(m.preco))) : 0;

              if (!mercados.length) {
                return <div className="sem-preco-modal">Este produto não possui preços cadastrados.</div>;
              }

              return (
                <div className="mercados-comparacao mercados-comparacao-modal">
                  {mercados.map((m, i) => {
                    const totalMercado = Number(m.preco) * Number(produtoSelecionado.quantidade);
                    const ehMaisBarato = mercados.length > 1 && Number(m.preco) === menor;
                    return (
                      <div key={i} className={`mercado-item ${ehMaisBarato ? "mercado-barato" : ""}`}>
                        <div className="mercado-nome">📍 {m.local}</div>
                        <div className="mercado-precos">
                          <div>
                            <small>Un.</small>
                            <strong>{formatarPreco(m.preco)}</strong>
                          </div>
                          <div>
                            <small>Total</small>
                            <strong>{formatarPreco(totalMercado)}</strong>
                          </div>
                        </div>
                        {ehMaisBarato && <span className="selo-barato">✓ Mais barato</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <button
              className={`botao-pegar ${produtoSelecionado.comprado ? "botao-desmarcar" : ""}`}
              onClick={async () => {
                await alternarComprado(produtoSelecionado.id);
                setProdutoSelecionado(null);
              }}
            >
              {produtoSelecionado.comprado ? "↩ Desmarcar como pego" : "✓ Marcar como pego"}
            </button>
            <button className="botao-editar-modal" onClick={() => iniciarEdicao(produtoSelecionado)}>
              ✏️ Editar produto
            </button>
            <button className="botao-excluir-modal" onClick={() => pedirExclusao(produtoSelecionado)}>
              🗑️ Excluir produto
            </button>
          </div>
        </div>
      )}

      {produtoParaExcluir && (
        <div className="modal-fundo modal-confirmacao-fundo" onClick={() => setProdutoParaExcluir(null)}>
          <div className="modal-confirmacao" onClick={(e) => e.stopPropagation()}>
            <div className="icone-exclusao">🗑️</div>
            <h2>Deseja excluir este produto?</h2>
            <p><strong>{produtoParaExcluir.nome}</strong> será removido da lista.</p>
            <div className="botoes-confirmacao">
              <button className="botao-cancelar" onClick={() => setProdutoParaExcluir(null)}>Cancelar</button>
              <button className="botao-confirmar-exclusao" onClick={confirmarExclusao}>🗑️ Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;