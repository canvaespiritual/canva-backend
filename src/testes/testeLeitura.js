const { carregarBaseFrutos } = require('../utils/processador');

const base = carregarBaseFrutos();

console.log('✅ Total de registros carregados:', base.length);
console.log('🧩 Primeiro registro:', base[0]);
