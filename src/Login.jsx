import logoCarrinho from "./assets/logo-carrinho.png";
import { useState } from "react";
import { Check, CircleAlert, Eye, EyeOff, Lock, Mail } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";

// Faz os e-mails do Firebase (verificação e redefinição) chegarem em português
auth.languageCode = "pt-BR";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MENSAGENS_ERRO = {
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/missing-email": "Digite seu e-mail.",
  "auth/user-not-found": "Não encontramos uma conta com esse e-mail.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Já existe uma conta com esse e-mail.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet. Verifique sua rede.",
};

function traduzirErro(erro) {
  return MENSAGENS_ERRO[erro?.code] || "Ocorreu um erro. Tente novamente.";
}

function Login() {
  const [modoCadastro, setModoCadastro] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [emailReset, setEmailReset] = useState("");

  function trocarModo() {
    setModoCadastro((atual) => !atual);
    setSenha("");
    setConfirmarSenha("");
    setMostrarSenha(false);
    setErro("");
  }

  async function enviarFormulario(event) {
    event.preventDefault();
    setErro("");

    const emailLimpo = email.trim();

    if (!emailLimpo || !senha) return setErro("Preencha seu e-mail e sua senha.");
    if (!EMAIL_VALIDO.test(emailLimpo)) return setErro("Digite um e-mail válido.");
    if (modoCadastro) {
      if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
      if (!confirmarSenha) return setErro("Confirme sua senha.");
      if (senha !== confirmarSenha) return setErro("As senhas não são iguais.");
    }

    try {
      setCarregando(true);
      if (modoCadastro) {
        const { user } = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
        await sendEmailVerification(user);
        // O App detecta o novo usuário e mostra a tela "Verifique seu e-mail".
      } else {
        await signInWithEmailAndPassword(auth, emailLimpo, senha);
      }
    } catch (falha) {
      console.error(falha);
      setErro(traduzirErro(falha));
    } finally {
      setCarregando(false);
    }
  }

  async function handleResetSenha() {
    setErro("");
    const emailLimpo = email.trim();
    if (!emailLimpo) return setErro("Digite seu e-mail acima para redefinir a senha.");
    if (!EMAIL_VALIDO.test(emailLimpo)) return setErro("Digite um e-mail válido.");

    try {
      setEnviandoReset(true);
      await sendPasswordResetEmail(auth, emailLimpo);
      setEmailReset(emailLimpo);
    } catch (falha) {
      console.error(falha);
      setErro(traduzirErro(falha));
    } finally {
      setEnviandoReset(false);
    }
  }

  const tipoSenha = mostrarSenha ? "text" : "password";

  return (
    <div className="tela-login">
      <div className="login-card">
        <div className="login-logo">
          <img src={logoCarrinho} alt="" />
        </div>

        <div className="login-cabecalho">
          <h1>Lista de Compras</h1>
          <p>{modoCadastro ? "Crie sua conta para começar" : "Entre na sua conta para continuar"}</p>
        </div>

        {erro && (
          <div className="erro-login" role="alert">
            <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
            <p>{erro}</p>
          </div>
        )}

        <form className="login-formulario" onSubmit={enviarFormulario} noValidate>
          <div className="campo-login">
            <label htmlFor="email">E-mail</label>
            <div className="input-login">
              <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErro("");
                }}
              />
            </div>
          </div>

          <div className="campo-login">
            <label htmlFor="senha">Senha</label>
            <div className="input-login">
              <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
              <input
                id="senha"
                type={tipoSenha}
                autoComplete={modoCadastro ? "new-password" : "current-password"}
                placeholder={modoCadastro ? "Mínimo de 6 caracteres" : "Digite sua senha"}
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErro("");
                }}
              />
              <button
                type="button"
                className="botao-ver-senha"
                onClick={() => setMostrarSenha((atual) => !atual)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          {modoCadastro && (
            <div className="campo-login">
              <label htmlFor="confirmarSenha">Confirmar senha</label>
              <div className="input-login">
                <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
                <input
                  id="confirmarSenha"
                  type={tipoSenha}
                  autoComplete="new-password"
                  placeholder="Digite sua senha novamente"
                  value={confirmarSenha}
                  onChange={(e) => {
                    setConfirmarSenha(e.target.value);
                    setErro("");
                  }}
                />
              </div>
            </div>
          )}

          <button type="submit" className="botao-login" disabled={carregando}>
            {carregando ? "Aguarde..." : modoCadastro ? "Criar minha conta" : "Entrar"}
          </button>
        </form>

        {!modoCadastro && (
          <div className="login-acoes">
            <button
              type="button"
              className="botao-esqueci-senha"
              onClick={handleResetSenha}
              disabled={enviandoReset}
            >
              {enviandoReset ? "Enviando..." : "Esqueci minha senha"}
            </button>
          </div>
        )}

        <div className="login-alternativa">
          <span>{modoCadastro ? "Já tem uma conta?" : "Ainda não tem uma conta?"}</span>
          <button type="button" onClick={trocarModo}>
            {modoCadastro ? "Entrar" : "Criar minha conta"}
          </button>
        </div>

        {emailReset && (
          <div className="modal-reset-overlay" onClick={() => setEmailReset("")}>
            <div
              className="modal-reset-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-reset"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-reset-icone">
                <Check size={28} strokeWidth={2} />
              </div>
              <h2 id="titulo-reset" className="modal-reset-titulo">
                E-mail enviado!
              </h2>
              <p className="modal-reset-texto">
                Se existir uma conta com <strong>{emailReset}</strong>, você vai receber um link
                para criar uma nova senha.
              </p>
              <p className="modal-reset-dica">Confira sua caixa de entrada e também a pasta de spam.</p>
              <button type="button" className="modal-reset-botao" onClick={() => setEmailReset("")}>
                Entendi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;