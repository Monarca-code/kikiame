import { Client, Account } from "https://cdn.jsdelivr.net/npm/appwrite@latest/+esm";

const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const account = new Account(client);

const formulario = document.getElementById("form-login");
const mensagem = document.getElementById("mensagem");
const botaoLogin = formulario.querySelector('button[type="submit"]');

const formularioRecuperacao = document.getElementById("form-recuperacao");
const mensagemRecuperacao = document.getElementById("mensagem-recuperacao");
const botaoRecuperacao = formularioRecuperacao.querySelector('button[type="submit"]');

const USER_ID_RECUPERACAO = "6afafa51817aca32384b";

document.getElementById("mostrar-recuperacao").addEventListener("click", () => {
    formulario.hidden = true;
    formularioRecuperacao.hidden = false;
    mensagemRecuperacao.textContent = "";
});

document.getElementById("voltar-login").addEventListener("click", () => {
    formularioRecuperacao.hidden = true;
    formulario.hidden = false;
    mensagem.textContent = "";
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
        if (error.code === 401) {
            mensagem.textContent = "Credenciais inválidas. Confirme o email e a palavra-passe.";
        } else if (error.code === 429) {
            mensagem.textContent = "Muitas tentativas. Aguarde alguns minutos.";
        } else {
            mensagem.textContent = error.message || "Não foi possível iniciar sessão.";
        }
    } finally {
        botaoLogin.disabled = false;
    }
});

formularioRecuperacao.addEventListener("submit", async (event) => {
    event.preventDefault();

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
            userId: USER_ID_RECUPERACAO,
            secret: codigo,
            password: novaPassword
        });

        formularioRecuperacao.reset();
        mensagemRecuperacao.textContent = "Palavra-passe atualizada. Volte ao login e entre com a nova palavra-passe.";
    } catch (error) {
        console.error("Erro na recuperação Appwrite:", error);
        if (error.code === 401 || error.code === 404) {
            mensagemRecuperacao.textContent = "Código inválido ou expirado. Solicite um novo código.";
        } else if (error.code === 429) {
            mensagemRecuperacao.textContent = "Muitas tentativas. Aguarde alguns minutos.";
        } else {
            mensagemRecuperacao.textContent = error.message || "Não foi possível atualizar a palavra-passe.";
        }
    } finally {
        botaoRecuperacao.disabled = false;
    }
});
