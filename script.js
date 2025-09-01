document.addEventListener('DOMContentLoaded', () => {
    const iqaForm = document.getElementById('iqa-form');
    const resultDialog = document.getElementById('result-dialog');
    const closeDialogBtn = document.getElementById('close-dialog-btn');
    
    // Função que calcula a saturação de Oxigênio Dissolvido (%)
    // a partir do valor em mg/L, temperatura e altitude.
    function calculateODSaturation(od_mg_L, temp_C, altitude_m) {
        if (temp_C < 0) temp_C = 0;

        // 1. Calcula o OD de saturação em mg/L ao nível do mar (fórmula empírica)
        const od_sat_sealevel = 14.652 - 0.41022 * temp_C + 0.007991 * (temp_C ** 2) - 0.000077774 * (temp_C ** 3);

        // 2. Corrige a saturação para a altitude local
        // A pressão atmosférica diminui com a altitude, reduzindo a solubilidade do gás.
        const pressao_local_ratio = Math.pow((1 - 0.0000225577 * altitude_m), 5.25588);
        const od_sat_corrigido = od_sat_sealevel * pressao_local_ratio;
        
        if (od_sat_corrigido <= 0) return 0; // Evita divisão por zero

        // 3. Calcula a porcentagem de saturação
        const od_percentual = (od_mg_L / od_sat_corrigido) * 100;

        return od_percentual > 0 ? od_percentual : 0;
    }

    // Funções para calcular q(i) para cada parâmetro (curvas de qualidade)
    // Usam as mesmas lógicas da versão anterior
    function getQ_Oxigenio(valor) { // Recebe % de saturação
        if (valor > 140) return 47;
        let q = 100.8 * Math.exp(-((valor - 102.3)**2) / 1301.9); // Curva mais precisa
        return q > 100 ? 100 : q;
    }

    function getQ_Coliformes(valor) {
        if (valor > 100000) return 3.2;
        let q = 98.2 - 35.8 * Math.log10(valor) + 3.14 * (Math.log10(valor)**2) + 0.068 * (Math.log10(valor)**3);
        return q < 3.2 ? 3.2 : q;
    }
    
    function getQ_pH(valor) {
        if (valor <= 2) return 2;
        if (valor >= 12) return 3;
        const p1 = 0.056 * (valor**3) - 1.54 * (valor**2) + 13.6 * valor + 24.5;
        const p2 = -0.09 * (valor**3) + 2.72 * (valor**2) - 26.6 * valor + 96.1;
        return valor < 7.5 ? p1 : p2;
    }

    function getQ_DBO(valor) {
        if (valor > 30) return 2;
        return 102.6 * Math.exp(-0.1101 * valor);
    }

    function getQ_Temperatura(delta_t) { // Usa a variação de temperatura
        if (delta_t > 15 || delta_t < -10) return 9;
        return 92.33 * Math.exp(-((delta_t - 0.098)**2) / 36.5);
    }
    
    function getQ_Nitrogenio(valor) {
        if (valor > 90) return 1;
        return 95.46 * Math.exp(-0.02 * valor) + 4.1 * Math.exp(-0.0001 * valor);
    }
    
    function getQ_Fosforo(valor) {
        if (valor > 10) return 5;
        return 96.4 * Math.exp(-2.66 * valor);
    }

    function getQ_Turbidez(valor) {
        if (valor > 100) return 5;
        return 97.34 * Math.exp(-0.0113 * valor) - 0.05 * valor;
    }

    function getQ_Solidos(valor) {
        if (valor > 500) return 30;
        return 80.26 * Math.exp(-0.0011 * valor) + 1.8 * Math.exp(0.00002 * valor);
    }

    function getIQAClassification(iqa) {
        if (iqa > 79) return { text: 'Ótima', class: 'otima' };
        if (iqa > 51) return { text: 'Boa', class: 'boa' };
        if (iqa > 36) return { text: 'Aceitável', class: 'aceitavel' };
        if (iqa > 19) return { text: 'Ruim', class: 'ruim' };
        return { text: 'Péssima', class: 'pessima' };
    }

    iqaForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Impede o recarregamento da página

        const inputs = {
            od_mg_L: parseFloat(document.getElementById('od_mg_l').value),
            temperatura_campo: parseFloat(document.getElementById('temperatura_campo').value),
            altitude: parseFloat(document.getElementById('altitude').value),
            coliformes: parseFloat(document.getElementById('coliformes').value),
            ph: parseFloat(document.getElementById('ph').value),
            dbo: parseFloat(document.getElementById('dbo').value),
            delta_temperatura: parseFloat(document.getElementById('delta_temperatura').value),
            nitrogenio: parseFloat(document.getElementById('nitrogenio').value),
            fosforo: parseFloat(document.getElementById('fosforo').value),
            turbidez: parseFloat(document.getElementById('turbidez').value),
            solidos: parseFloat(document.getElementById('solidos').value)
        };
        
        // 1. Calcula o parâmetro intermediário (saturação de OD)
        const od_saturacao = calculateODSaturation(inputs.od_mg_L, inputs.temperatura_campo, inputs.altitude);

        // 2. Calcula os valores de qualidade q(i)
        const q = {
            oxigenio: getQ_Oxigenio(od_saturacao),
            coliformes: getQ_Coliformes(inputs.coliformes),
            ph: getQ_pH(inputs.ph),
            dbo: getQ_DBO(inputs.dbo),
            temperatura: getQ_Temperatura(inputs.delta_temperatura),
            nitrogenio: getQ_Nitrogenio(inputs.nitrogenio),
            fosforo: getQ_Fosforo(inputs.fosforo),
            turbidez: getQ_Turbidez(inputs.turbidez),
            solidos: getQ_Solidos(inputs.solidos)
        };

        const weights = {
            oxigenio: 0.17, coliformes: 0.15, ph: 0.12, dbo: 0.10,
            temperatura: 0.10, nitrogenio: 0.10, fosforo: 0.10,
            turbidez: 0.08, solidos: 0.08
        };

        // 3. Calcula o IQA final
        let iqa = Object.keys(q).reduce((prod, key) => prod * Math.pow(Math.max(q[key], 1), weights[key]), 1);

        // 4. Exibe os resultados no dialog
        const finalIQA = iqa.toFixed(2);
        const classification = getIQAClassification(finalIQA);

        document.getElementById('iqa-value').textContent = finalIQA;
        const qualitySpan = document.getElementById('iqa-quality');
        qualitySpan.textContent = classification.text;
        qualitySpan.className = ''; // Limpa classes antigas
        qualitySpan.classList.add(classification.class);

        resultDialog.showModal(); // Abre o dialog
    });

    // Fecha o dialog ao clicar no botão "Fechar"
    closeDialogBtn.addEventListener('click', () => {
        resultDialog.close();
    });

    // Fecha o dialog se o usuário clicar fora dele (no backdrop)
    resultDialog.addEventListener("click", e => {
        const dialogDimensions = resultDialog.getBoundingClientRect()
        if (
            e.clientX < dialogDimensions.left ||
            e.clientX > dialogDimensions.right ||
            e.clientY < dialogDimensions.top ||
            e.clientY > dialogDimensions.bottom
        ) {
            resultDialog.close()
        }
    });
});