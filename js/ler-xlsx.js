// =============================================================
// ler-xlsx.js: lê um arquivo .xlsx no navegador, sem biblioteca de fora.
// O .xlsx é um .zip com arquivos XML dentro: abre o zip, lê o XML de cada aba
// e devolve { 'Nome da aba': [ [linha 1], [linha 2], ... ] }.
// =============================================================

export async function lerXlsx(arquivo) {
    const abrir = await abrirZip(await arquivo.arrayBuffer());
    const xml = async caminho => {
        const texto = await abrir(caminho);
        return texto === null ? null : new DOMParser().parseFromString(texto, 'application/xml');
    };
    const tags = (no, nome) => [...no.getElementsByTagNameNS('*', nome)];

    // Textos repetidos ficam numa lista só (sharedStrings); as células guardam a posição nela
    const compartilhados = [];
    const ss = await xml('xl/sharedStrings.xml');
    if (ss) {
        for (const si of tags(ss, 'si')) compartilhados.push(tags(si, 't').map(t => t.textContent).join(''));
    }

    // Nome de cada aba → arquivo XML dela
    const livro = await xml('xl/workbook.xml');
    const ligacoes = await xml('xl/_rels/workbook.xml.rels');
    if (!livro || !ligacoes) throw new Error('O arquivo não é um .xlsx');
    const alvo = {};
    for (const r of tags(ligacoes, 'Relationship')) alvo[r.getAttribute('Id')] = r.getAttribute('Target');

    const abas = {};
    for (const aba of tags(livro, 'sheet')) {
        const id = aba.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
            || aba.getAttribute('r:id');
        const caminho = (alvo[id] || '').startsWith('/') ? alvo[id].slice(1) : 'xl/' + alvo[id];
        const doc = await xml(caminho);
        if (doc) abas[aba.getAttribute('name')] = lerAba(doc, compartilhados, tags);
    }
    return abas;
}

// Uma aba: cada <row> vira uma lista; cada <c> (célula) vai para a coluna dela
function lerAba(doc, compartilhados, tags) {
    const linhas = [];
    for (const row of tags(doc, 'row')) {
        const linha = [];
        for (const c of tags(row, 'c')) {
            const tipo = c.getAttribute('t');
            const v = tags(c, 'v')[0];
            let valor = v ? v.textContent : '';
            if (tipo === 's') valor = compartilhados[Number(valor)] ?? '';                       // texto da lista
            else if (tipo === 'inlineStr') valor = tags(c, 't').map(t => t.textContent).join('');  // texto na própria célula
            else if (tipo === 'b') valor = valor === '1';                                         // verdadeiro/falso
            else if (tipo !== 'str' && tipo !== 'e' && valor !== '') valor = Number(valor);        // número
            linha[colunaDe(c.getAttribute('r'))] = valor;
        }
        linhas[Number(row.getAttribute('r')) - 1] = linha;
    }
    return Array.from(linhas, l => Array.from(l || [], v => v ?? ''));   // tira os buracos (células vazias)
}

// "C12" → 2 (A = 0, B = 1, ..., Z = 25, AA = 26)
function colunaDe(referencia) {
    const letras = String(referencia).match(/^[A-Z]+/)[0];
    return [...letras].reduce((n, letra) => n * 26 + letra.charCodeAt(0) - 64, 0) - 1;
}

// Abre o .zip e devolve uma função: (caminho do arquivo lá dentro) → texto, ou null se não existe
async function abrirZip(buffer) {
    const d = new DataView(buffer);

    // O "índice" do zip fica no fim: procura a assinatura 0x06054b50 de trás para frente
    let fim = buffer.byteLength - 22;
    while (fim >= 0 && d.getUint32(fim, true) !== 0x06054b50) fim--;
    if (fim < 0) throw new Error('O arquivo não é um .xlsx');

    const total = d.getUint16(fim + 10, true);   // quantos arquivos tem dentro
    let p = d.getUint32(fim + 16, true);          // onde começa o índice
    const arquivos = {};
    for (let i = 0; i < total; i++) {
        const tamanhoNome = d.getUint16(p + 28, true);
        const nome = new TextDecoder().decode(new Uint8Array(buffer, p + 46, tamanhoNome));
        arquivos[nome] = {
            metodo: d.getUint16(p + 10, true),        // 0 = guardado, 8 = comprimido
            tamanho: d.getUint32(p + 20, true),       // tamanho comprimido
            local: d.getUint32(p + 42, true)          // onde estão os dados
        };
        p += 46 + tamanhoNome + d.getUint16(p + 30, true) + d.getUint16(p + 32, true);
    }

    return async caminho => {
        const a = arquivos[caminho];
        if (!a) return null;
        const inicio = a.local + 30 + d.getUint16(a.local + 26, true) + d.getUint16(a.local + 28, true);
        const dados = new Uint8Array(buffer, inicio, a.tamanho);
        if (a.metodo === 0) return new TextDecoder().decode(dados);
        // Descomprime com o que o próprio navegador já tem
        const fluxo = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(fluxo).text();
    };
}