import { Client, Account } from "https://cdn.jsdelivr.net/npm/appwrite@17.0.0/+esm";

const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const account = new Account(client);

const formulario = document.getElementById("form-login");
const mensagem = document.getElementById("mensagem");
const botao = formulario.querySelector('button[type="submit"]');

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const emailCampo = formulario.elements.namedItem("email");
    const passwordCampo = formulario.elements.namedItem("password");

    const email = String(emailCampo?.value || "").trim();
    const password = String(passwordCampo?.value || "");

    if (!email || !password) {
        mensagem.textContent = "Introduza o email e a palavra-passe.";
        return;
    }

    if (password.length < 8) {
        mensagem.textContent = "A palavra-passe deve ter pelo menos 8 caracteres.";
        return;
    }

    mensagem.textContent = "A validar as credenciais...";
    botao.disabled = true;

    try {
        await account.createEmailPasswordSession({
            email: email,
            password: password
        });

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
        botao.disabled = false;
    }
});
