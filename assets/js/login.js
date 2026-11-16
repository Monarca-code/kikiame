import { Client, Account } from "https://cdn.jsdelivr.net/npm/appwrite@17.0.0/+esm";

const client = new Client()
    .setEndpoint("https://cloud.appwrite.io/v1")
    .setProject("6afaee080036fbc10c12");

const account = new Account(client);

const formulario = document.getElementById("form-login");
const mensagem = document.getElementById("mensagem");

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    mensagem.textContent = "A entrar...";
    mensagem.style.color = "";

    try {
        await account.createEmailPasswordSession({ email, password });
        window.location.href = "admin.html";
    } catch (error) {
        console.error("Erro de login Appwrite:", error);
        mensagem.textContent = "Email ou palavra-passe incorretos.";
    }
});
