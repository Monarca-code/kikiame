const { Client, Account } = window.Appwrite;

const client = new Client()
  .setEndpoint("https://syd.cloud.appwrite.io/v1")
  .setProject("6afaee080036fbc10c12");

const account = new Account(client);

// Se já existir uma sessão válida neste navegador, abrir diretamente a área administrativa.
// A sessão é gerida pelo Appwrite; não guardar palavras-passe no dispositivo.
(async function restaurarSessao() {
  try {
    await account.get();
    window.location.replace("admin.html");
  } catch (_) {
    // Sem sessão válida: manter o formulário de login visível.
  }
})();

const formulario = document.getElementById("form-login");
const mensagem = document.getElementById("mensagem");
const botaoLogin = formulario.querySelector('button[type="submit"]');

const formularioRecuperacao = document.getElementById("form-recuperacao");
const mensagemRecuperacao = document.getElementById("mensagem-recuperacao");
const emailRecuperacao = document.getElementById("email-recuperacao");
const botaoEnviarCodigo = document.getElementById("enviar-codigo");
const camposConfirmacao = document.getElementById("campos-confirmacao");
const botaoRecuperacao = document.getElementById("confirmar-recuperacao");

const camposRecuperacao = [
  formularioRecuperacao.elements.namedItem("codigo"),
  formularioRecuperacao.elements.namedItem("novaPassword"),
  formularioRecuperacao.elements.namedItem("confirmarPassword")
];

let recoveryUserId = null;

function ativarCamposConfirmacao(ativo) {
  camposConfirmacao.hidden = !ativo;
  camposRecuperacao.forEach((campo) => {
    campo.disabled = !ativo;
    campo.required = ativo;
    if (!ativo) campo.value = "";
  });
  botaoRecuperacao.disabled = !ativo;
}

document.getElementById("mostrar-recuperacao").addEventListener("click", () => {
  const emailLogin = String(formulario.elements.namedItem("email")?.value || "").trim();
  emailRecuperacao.value = emailLogin;
  formulario.hidden = true;
  formularioRecuperacao.hidden = false;
  mensagemRecuperacao.textContent = "";
  recoveryUserId = null;
  ativarCamposConfirmacao(false);
});

document.getElementById("voltar-login").addEventListener("click", () => {
  formularioRecuperacao.hidden = true;
  formulario.hidden = false;
  mensagem.textContent = "";
  mensagemRecuperacao.textContent = "";
  recoveryUserId = null;
  ativarCamposConfirmacao(false);
});

formulario.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = String(formulario.elements.namedItem("email")?.value || "").trim();
  const password = String(formulario.elements.namedItem("password")?.value || "");

  if (!email || !password) {
    mensagem.textContent = "Introduza o email e a palavra-passe.";
    return;
  }

  mensagem.textContent = "A validar as credenciais...";
  botaoLogin.disabled = true;

  try {
    await account.createEmailPasswordSession({ email, password });
    window.location.replace("admin.html");
  } catch (error) {
    console.error("Erro de login Appwrite:", error);
    mensagem.textContent = error.code === 401
      ? "Credenciais inválidas. Confirme o email e a palavra-passe."
      : error.message || "Não foi possível iniciar sessão.";
  } finally {
    botaoLogin.disabled = false;
  }
});

botaoEnviarCodigo.addEventListener("click", async () => {
  const email = String(emailRecuperacao.value || "").trim();

  if (!email) {
    mensagemRecuperacao.textContent = "Introduza o email associado à sua conta.";
    emailRecuperacao.focus();
    return;
  }

  if (!emailRecuperacao.checkValidity()) {
    mensagemRecuperacao.textContent = "Introduza um endereço de email válido.";
    emailRecuperacao.focus();
    return;
  }

  botaoEnviarCodigo.disabled = true;
  botaoEnviarCodigo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar código...';
  mensagemRecuperacao.textContent = "";
  recoveryUserId = null;
  ativarCamposConfirmacao(false);

  try {
    const token = await account.createRecoveryOTP({ email });
    recoveryUserId = token.userId;
    ativarCamposConfirmacao(true);
    mensagemRecuperacao.textContent =
      "Se existir uma conta ativa associada a este email, receberá um código de 6 dígitos. Verifique também o spam. O código é válido durante 15 minutos.";
    formularioRecuperacao.elements.namedItem("codigo").focus();
  } catch (error) {
    console.error("Erro ao solicitar código de recuperação Appwrite:", error);

    if (error.code === 429) {
      mensagemRecuperacao.textContent = "Foram feitas demasiadas tentativas. Aguarde alguns minutos antes de tentar novamente.";
    } else if (error.code === 400) {
      mensagemRecuperacao.textContent = "O email introduzido não é válido. Verifique e tente novamente.";
    } else {
      mensagemRecuperacao.textContent = "Não foi possível solicitar o código neste momento. Tente novamente e consulte a consola do navegador se o problema continuar.";
    }
  } finally {
    botaoEnviarCodigo.disabled = false;
    botaoEnviarCodigo.innerHTML = '<i class="fa-solid fa-envelope"></i> Enviar código de confirmação';
  }
});

formularioRecuperacao.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!recoveryUserId) {
    mensagemRecuperacao.textContent = "Solicite primeiro um código de confirmação.";
    return;
  }

  const codigo = String(formularioRecuperacao.elements.namedItem("codigo")?.value || "").trim();
  const novaPassword = String(formularioRecuperacao.elements.namedItem("novaPassword")?.value || "");
  const confirmarPassword = String(formularioRecuperacao.elements.namedItem("confirmarPassword")?.value || "");

  if (!/^[0-9]{6}$/.test(codigo)) {
    mensagemRecuperacao.textContent = "Introduza o código de 6 dígitos recebido por email.";
    return;
  }

  if (novaPassword.length < 8) {
    mensagemRecuperacao.textContent = "A nova palavra-passe deve ter pelo menos 8 caracteres.";
    return;
  }

  if (novaPassword !== confirmarPassword) {
    mensagemRecuperacao.textContent = "As palavras-passe não coincidem.";
    return;
  }

  botaoRecuperacao.disabled = true;
  mensagemRecuperacao.textContent = "A confirmar o código e atualizar a palavra-passe...";

  try {
    await account.updateRecoveryOTP({
      userId: recoveryUserId,
      secret: codigo,
      password: novaPassword
    });

    recoveryUserId = null;
    formularioRecuperacao.reset();
    ativarCamposConfirmacao(false);
    mensagemRecuperacao.textContent =
      "Palavra-passe atualizada com sucesso. Volte ao login e entre com a nova palavra-passe.";
  } catch (error) {
    console.error("Erro na confirmação da recuperação Appwrite:", error);

    if (error.code === 401 || error.code === 404 || error.type === "user_invalid_token") {
      mensagemRecuperacao.textContent = "Código inválido ou expirado. Solicite um novo código e tente novamente.";
    } else {
      mensagemRecuperacao.textContent = error.message || "Não foi possível atualizar a palavra-passe. Verifique os requisitos de segurança definidos no Appwrite.";
    }
  } finally {
    botaoRecuperacao.disabled = !recoveryUserId;
  }
});
