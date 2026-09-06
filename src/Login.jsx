import logoCarrinho from "./assets/logo-carrinho.png";
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

function Login() {
  const [modoCadastro, setModoCadastro] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [mostrarModalEmail, setMostrarModalEmail] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [usuarioRecente, setUsuarioRecente] = useState(null);

  function trocarModo() {
    setModoCadastro(!modoCadastro);
    setEmail("");
    setSenha("");
    setConfirmarSenha("");
    setErro("");
    setMostrarModalEmail(false);
    setUsuarioRecente(null);
  }

  async function enviarFormulario(event) {
    event.preventDefault();
    setErro("");
    setMostrarModalEmail(false);

    if (!email || !senha) {
      setErro("Preencha seu e-mail e sua senha.");
      return;
    }

    if (modoCadastro && !confirmarSenha) {
      setErro("Confirme sua senha.");
      return;
    }

    if (modoCadastro && senha !== confirmarSenha) {
      setErro("As senhas não são iguais.");
      return;
    }

    if (modoCadastro && senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setCarregando(true);

      if (modoCadastro) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          senha
        );

        await sendEmailVerification(userCredential.user);

        setUsuarioRecente(userCredential.user);
        setMostrarModalEmail(true);

        setEmail("");
        setSenha("");
        setConfirmarSenha("");
      } else {
        await signInWithEmailAndPassword(auth, email, senha);
      }
    } catch (error) {
      console.error(error);

      switch (error.code) {
        case "auth/invalid-email":
          setErro("Digite um e-mail válido.");
          break;
        case "auth/user-not-found":
          setErro("Não encontramos uma conta com esse e-mail.");
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setErro("E-mail ou senha incorretos.");
          break;
        case "auth/email-already-in-use":
          setErro("Já existe uma conta com esse e-mail.");
          break;
        case "auth/weak-password":
          setErro("A senha precisa ter pelo menos 6 caracteres.");
          break;
        default:
          setErro("Ocorreu um erro. Tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handleReenviar() {
    if (!usuarioRecente) return;

    setReenviando(true);

    try {
      await sendEmailVerification(usuarioRecente);
      alert("E-mail de verificação reenviado! Verifique sua caixa de entrada.");
    } catch (error) {
      alert("Erro ao reenviar. Tente novamente.");
    } finally {
      setReenviando(false);
    }
  }

  async function handleOk() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao deslogar:", error);
    } finally {
      setMostrarModalEmail(false);
      setUsuarioRecente(null);
      setModoCadastro(false);
    }
  }

  async function handleResetSenha() {
    if (!email) {
      setErro("Digite seu e-mail para redefinir a senha.");
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      await sendPasswordResetEmail(auth, email);
      alert("Enviamos um link para redefinir sua senha.");
    } catch (error) {
      setErro("Erro ao enviar e-mail de redefinição.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="tela-login">
      <div className="login-card">
        <div className="login-logo">
          <img src={logoCarrinho} alt="Lista de Compras" />
        </div>

        <div className="login-cabecalho">
          <h1>Lista de Compras</h1>
          <p>
            {modoCadastro
              ? "Crie sua conta para começar"
              : "Entre na sua conta para continuar"}
          </p>
        </div>

        {erro && (
          <div className="erro-login">
            <span>!</span>
            <p>{erro}</p>
          </div>
        )}

        <form className="login-formulario" onSubmit={enviarFormulario}>
          <div className="campo-login">
            <label htmlFor="email">E-mail</label>
            <div className="input-login">
              <span>✉</span>
              <input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="campo-login">
            <label htmlFor="senha">Senha</label>
            <div className="input-login">
              <span>🔒</span>
              <input
                id="senha"
                type="password"
                placeholder="Digite sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
          </div>

          {modoCadastro && (
            <div className="campo-login">
              <label htmlFor="confirmarSenha">Confirmar senha</label>
              <div className="input-login">
                <span>🔒</span>
                <input
                  id="confirmarSenha"
                  type="password"
                  placeholder="Digite sua senha novamente"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="botao-login"
            disabled={carregando}
          >
            {carregando
              ? "Aguarde..."
              : modoCadastro
              ? "Criar minha conta"
              : "Entrar"}
          </button>
        </form>

        {!modoCadastro && (
          <div className="login-acoes">
            <button
              type="button"
              className="botao-esqueci-senha"
              onClick={handleResetSenha}
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        <div className="login-alternativa">
          <span>
            {modoCadastro
              ? "Já tem uma conta?"
              : "Ainda não tem uma conta?"}
          </span>

          <button type="button" onClick={trocarModo}>
            {modoCadastro ? "Entrar" : "Criar minha conta"}
          </button>
        </div>

        {mostrarModalEmail && usuarioRecente && (
          <div className="modal-email-enviado">
            <div className="modal-card">
              <div className="icone-email-modal">📧</div>

              <h2>Verifique seu e-mail</h2>

              <p>
                Enviamos um link de confirmação para{" "}
                <strong>{usuarioRecente.email}</strong>.
                <br />
                Clique nele para ativar sua conta e depois faça login novamente.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <button
                  className="botao-reenviar"
                  onClick={handleReenviar}
                  disabled={reenviando}
                >
                  {reenviando
                    ? "Enviando..."
                    : "Reenviar e-mail de verificação"}
                </button>

                <button className="botao-ok" onClick={handleOk}>
                  Ok
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;