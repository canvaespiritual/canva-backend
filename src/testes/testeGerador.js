const { gerarJsonRelatorio } = require('../utils/processador');

const respostasUsuario = [
  'AM01', 'AG02', 'BO03', 'CD04',
  'DE05', 'EF06', 'FG07', 'GH08',
  'HI09', 'IJ10', 'JK11', 'KL12'
];

const jsonFinal = gerarJsonRelatorio(respostasUsuario, 'Gustavo Prado');

console.log(JSON.stringify(jsonFinal, null, 2));
