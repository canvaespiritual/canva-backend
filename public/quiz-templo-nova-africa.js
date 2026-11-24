(function () {
  const niveis = Object.freeze([1, 2, 3, 4, 6, 9, 10, 11, 12]);

  if (typeof module === "object" && module.exports) {
    module.exports = { niveis };
    return;
  }

  window.quizTemploNovaAfrica = {
    niveis,
    mostrarFormulario(respostas) {
      const container = document.getElementById("quiz-container");
      container.innerHTML = `
        <section class="mx-auto max-w-lg space-y-5 px-5 py-8">
          <h2 class="text-2xl font-semibold">Seu Mapa da Alma está pronto</h2>
          <p class="text-gray-600">Abra o relatório completo gratuitamente. Se quiser deixar seu contato para a equipe do Canva Espiritual, preencha um ou ambos os campos.</p>
          <form class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium">E-mail (opcional)</label>
              <input id="email" name="email" type="email" maxlength="254" autocomplete="email" class="mt-1 w-full rounded border p-3">
            </div>
            <div>
              <label for="telefone" class="block text-sm font-medium">Telefone (opcional)</label>
              <input id="telefone" name="telefone" type="tel" maxlength="40" autocomplete="tel" class="mt-1 w-full rounded border p-3">
            </div>
            <button class="w-full rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-60">Ver meu relatório</button>
            <p role="status" class="text-sm text-gray-600"></p>
          </form>
        </section>
      `;

      const form = container.querySelector("form");
      const status = form.querySelector("[role=status]");
      const button = form.querySelector("button");
      const id = crypto.randomUUID();
      window.scrollTo(0, 0);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (button.disabled) return;
        button.disabled = true;
        status.textContent = "Preparando seu relatório…";

        try {
          const contato = Object.fromEntries(new FormData(form));
          const response = await fetch("/mapa-da-alma-templo-nova-africa/relatorio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, respostas, ...contato })
          });
          if (!response.ok) throw new Error(await response.text());

          const html = await response.text();
          const frame = document.createElement("iframe");
          frame.title = "Relatório completo do Mapa da Alma";
          frame.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
          frame.className = "block w-full border-0";
          frame.style.height = "100dvh";
          frame.srcdoc = html;
          document.querySelector("#barra-container")?.remove();
          document.querySelector("#cabecalho-templo")?.remove();
          container.replaceChildren(frame);
          window.scrollTo(0, 0);
          frame.focus();
        } catch (error) {
          status.textContent = error.message === "Failed to fetch"
            ? "A conexão caiu. Tente abrir o relatório novamente."
            : error.message;
          button.disabled = false;
        }
      });
    }
  };
})();
