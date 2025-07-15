// frutas.js
// Lista de frutos espirituais e função para classificar zonas por nota

export const nomesFrutos = [
  "Amor", "Paz", "Bondade", "Mansidão",
  "Fé", "Esperança", "Fidelidade", "Paciência",
  "Alegria", "Longanimidade", "Benignidade", "Modéstia"
];

// Função opcional para classificar zona (🔴 ⚪ 🔵) com base na nota
export function zonaPorNota(nota) {
  if (nota >= 9) return "🔵";
  if (nota >= 6) return "⚪";
  return "🔴";
}
