document.addEventListener('DOMContentLoaded', function () {
    var modeSwitch = document.querySelector('.mode-switch');

    modeSwitch.addEventListener('click', function () {
        document.documentElement.classList.toggle('dark');
        modeSwitch.classList.toggle('active');
    });


    document.querySelector('.messages-btn').addEventListener('click', function () {
        document.querySelector('.messages-section').classList.add('show');
    });

    document.querySelector('.messages-close').addEventListener('click', function () {
        document.querySelector('.messages-section').classList.remove('show');
    });

});

document.addEventListener('DOMContentLoaded', function () {
    var dropdownSubLabels = document.querySelectorAll('.dropdown-sub-label');

    dropdownSubLabels.forEach(function (label) {
        label.addEventListener('click', function () {
            var dropdownId = this.getAttribute('for').replace('dropdown-sub-', '');
            console.log('Dropdown ID:', dropdownId);
            toggleDropdownSub(dropdownId);
        });
    });
});

function toggleDropdownSub(dropdownId) {
    var dropdownSubSections = document.querySelectorAll('.section-dropdown-sub');

    // Nascondi tutti i dropdown-sub
    dropdownSubSections.forEach(function (section) {
        section.style.display = 'none';
    });

    // Mostra solo il dropdown-sub corrispondente
    var dropdownSub = document.querySelector('.section-dropdown-sub[data-dropdown-id="' + dropdownId + '"]');
    if (dropdownSub) {
        dropdownSub.style.display = (dropdownSub.style.display === 'block') ? 'none' : 'block';
    }
}


document.addEventListener('DOMContentLoaded', function () {

    const dropdown = document.querySelector('.section-dropdown');
    console.log('Dropdown:', dropdown);

    const searchInput = document.getElementById('search-input');
    console.log('Search Input:', searchInput);

    dropdown.addEventListener('change', function () {
        console.log('Dropdown change event triggered');
        updateResults();
    });

    searchInput.addEventListener('input', function () {
        console.log('Search input event triggered');
        updateResults();
    });


    function updateResults() {
        console.log('Updating results = ');

        // Modifica nella raccolta dei valori dei filtri
        const selectedFilters = [];
        const dropdownSubCheckboxes = document.querySelectorAll('.dropdown-sub:checked');

        dropdownSubCheckboxes.forEach(checkbox => {
            const tableName = checkbox.id.replace('dropdown-sub-', '');
            const values = Array.from(document.querySelectorAll(`.section-dropdown-sub[data-dropdown-id="${tableName}"] .checkbox-sub:checked`))
                .map(checkbox => checkbox.id.replace('checkbox-', ''));

            selectedFilters.push({tableName, values});
        });


        console.log('js Selected Filters:', selectedFilters);

        const searchTerm = searchInput.value;

        console.log('js Search Term:', searchTerm);


        // Modifica nella struttura dei dati inviati al server
        let selectedFiltersForSearch = {};
        selectedFilters.forEach(filter => {
            const tableName = filter.tableName;
            const values = filter.values;

            values.forEach(value => {
                if (!selectedFiltersForSearch[tableName]) {
                    selectedFiltersForSearch[tableName] = [];
                }

                selectedFiltersForSearch[tableName] = values;
            });
        });
        selectedFiltersForSearch = JSON.stringify(selectedFiltersForSearch);


        fetch('/update_results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                search_term: searchTerm,
                selected_filters: selectedFiltersForSearch,
            }),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server response: ${response.status} - ${response.statusText}`);
                }
                return response.json();
            })
            // Modifica la parte relativa alla gestione della risposta AJAX
            // Modifica la parte relativa alla gestione della risposta AJAX
            .then(data => {
                if (data.error) {
                    console.error(data.error);
                } else {
                    // Assicurati che 'data.result' sia un array di oggetti con le chiavi desiderate
                    const products = data.result;

                    // Aggiorna il contenuto HTML della sezione dei risultati
                    const resultsContainer = document.getElementById('results-container');
                    resultsContainer.innerHTML = '';  // Pulisce il contenuto precedente

                    // Cicla attraverso i prodotti e crea gli elementi HTML
                    products.forEach(prodotto => {
                        const boxWrapper = document.createElement('div');
                        boxWrapper.classList.add('project-box-wrapper');

                        const box = document.createElement('div');
                        box.classList.add('project-box');

                        const contentHeader = document.createElement('div');
                        contentHeader.classList.add('project-box-content-header');

                        const imageElement = document.createElement('img');
                        imageElement.src = ('static/images/' + prodotto.immagine);
                        imageElement.alt = prodotto.prodotto_nome;
                        contentHeader.appendChild(imageElement);

                        const productName = document.createElement('p');
                        productName.classList.add('box-content-header');
                        productName.textContent = prodotto.prodotto_nome;
                        contentHeader.appendChild(productName);

                        const priceElement = document.createElement('p');
                        priceElement.classList.add('box-content-subheader');
                        priceElement.textContent = prodotto.prezzo;
                        contentHeader.appendChild(priceElement);

                        const productIdElement = document.createElement('p');
                        productIdElement.classList.add('box-content-id');
                        productIdElement.textContent = prodotto.id;  // Aggiungi l'ID al contenuto del paragrafo
                        contentHeader.appendChild(productIdElement);

                        const addToCartButton = document.createElement('button');
                        addToCartButton.classList.add('addToCart');
                        addToCartButton.textContent = 'Add';
                        contentHeader.appendChild(addToCartButton);

                        // Aggiungi gli elementi creati al DOM
                        box.appendChild(contentHeader);
                        boxWrapper.appendChild(box);
                        resultsContainer.appendChild(boxWrapper);
                    });
                }
            })

            .catch(error => console.error(error));
    }
});
