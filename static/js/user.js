var taxRate = 0.05;
var shippingRate = 15.00;
var fadeTime = 300;
var isLoggedIn = false;
var currentCart = [];

function contaGiorni(inizio, fine) {
    return (new Date(fine) - new Date(inizio)) / (1000 * 60 * 60 * 24);
}

function loadUserCart() {
    $.ajax({
        url: '/user/cart',
        type: 'GET',
        success: function (cartData) {
            console.log(cartData);  // Controlla i dati ricevuti dal server
            currentCart = cartData;
            replaceCart();
            console.log('User cart loaded successfully');
        },
        error: function (error) {
            console.error('Error loading user cart:', error.responseText);
        }
    });
}

function login(email, password) {
    $.ajax({
        url: '/login',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({email: email, password: password}),
        success: function (response) {
            if (response.redirect) {
                isLoggedIn = true;
                console.log('Login successful');
                loadUserCart();
                window.location.href = response.redirect;
            } else {
                console.error('Login failed:', response.error);
            }
        },
        error: function (error) {
            console.error('Error during login:', error.responseText);
        }
    });
}


function register(email, password) {
    console.log(`Registering user with email ${email} and password ${password}`);
    $.ajax({
        url: '/register',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({email: email, password: password}),
        success: function () {
            console.log('Register successful');
            login(email, password);
        },
        error: function (error) {
            if (error.status === 409) {
                console.error('User already exists'); // Handle user already exists error
            } else {
                console.error('Registration failed'); // Handle other registration errors
            }
        }
    });
}

function logoutUser() {
    // Perform an AJAX request to the server to log the user out
    fetch('/logout', {
        method: 'GET',
    })
        .then(response => {
            if (response.ok) {
                // Redirect to the home page after successful logout
                window.location.href = '/';
            } else {
                console.error('Logout failed');
            }
        })
        .catch(error => {
            console.error('Error during logout:', error);
        });
}

function checkout() {
    var cartIsValid = true;

    // Verifica se ci sono date vuote nei prodotti nel carrello
    $('.product').each(function () {
        var dataInizio = $(this).find('.product-date1 input').val();
        var dataFine = $(this).find('.product-date2 input').val();

        if (dataInizio === '' || dataFine === '') {
            cartIsValid = false;
            return false; // Esci dal loop se almeno un prodotto ha date vuote
        }
    });

    if (isLoggedIn && cartIsValid) {
        $.ajax({
            url: '/checkout',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({currentCart}),
            success: function (response) {
                $('.product').remove();
                console.log(response.message);
            },
            error: function (error) {
                console.error(error.responseText);
            }
        });
    } else if (!isLoggedIn) {
        console.error('Registrazione richiesta');
    } else {
        console.error('Almeno un prodotto nel carrello ha date vuote. Correggi prima di procedere al checkout.');
    }
}


$('.checkout').click(function () {
    checkout();
});


$(document).ready(function () {
    console.log(isLoggedIn);

    if (isLoggedIn) {
        loadUserCart();
    }

    // Delega degli eventi per cambio e clic a un elemento statico (es. '.shopping-cart')
    $('.shopping-cart').on('change', '.product-date1 input, .product-date2 input, .product-quantity input', function () {
        console.log('Change detected');
        var productRow = $(this).closest('.product');
        updateProduct(productRow);
    });

    $('.shopping-cart').on('click', '.product-removal button', function () {
        console.log('Remove button clicked');
        var productRow = $(this).closest('.product');
        removeFromCart(productRow);
    });

    console.log("Dopo il ready function");
});

function removeFromCart(productRow) {
    var id = productRow.find('.product-details').text()
    if (isLoggedIn) {
        $.ajax({
            url: '/user/cart/remove',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({product_id: id}),
            success: function (response) {
                if (response.success) {
                    console.log(response.message);
                    productRow.slideUp(300, function () {
                        $(this).remove();
                        recalculateCart();
                    });
                } else {
                    console.error(response.message);
                }
            },
            error: function (error) {
                console.error(error.responseText);
            }
        });
    } else {
        productRow.slideUp(fadeTime, function () {
            $(this).remove();
            recalculateCart();
        });
    }
}


// Delega l'evento clic per il pulsante "Aggiungi al carrello"
$(document).ready(function () {
    // Delega l'evento di clic a un elemento statico (es. '#results-container')
    $('#results-container').on('click', '.addToCart', function () {
        var productRow = $(this).closest('.project-box');
        var productId = productRow.find('.box-content-id').text().trim();

        if (productId) {
            fetchById(productId);
            add_to_cart(productId);
        } else {
            console.error('Invalid productId:', productId);
        }
    });
});

function add_to_cart(productId, quantity, data1, data2) {
    if (isLoggedIn) {
        $.ajax({
            url: '/user/cart/add',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({product_id: productId, quantity: quantity, data1: data1, data2: data2}),
            success: function (response) {
                if (response.success) {
                    console.log(response.message);
                } else {
                    console.error(response.message);
                }
            },
            error: function (error) {
                console.error(error.responseText);
            }
        });
    }

}

function fetchById(productId) {
    $.ajax({
        url: '/prodotti/' + productId,
        type: 'GET',
        success: function (product) {
            console.log('Product loaded successfully');

            var existingProduct = $('.product[data-product-id="' + productId + '"]');

            if (existingProduct.length > 0) {
                // If the product is already in the cart, update its quantity
                var quantityInput = existingProduct.find('.product-quantity input');
                quantityInput.val(parseFloat(quantityInput.val()) + 1);
            } else {
                // If the product is not in the cart, add a new row
                drawCart(product);
            }
        },
    });
}

function drawCart(product) {
    // Set default values if properties are null
    var nome = product.nome || 'null';
    var immagine = product.immagine;
    var prezzo = product.prezzo || 0.00;
    var formattedDataInizio = formatDate(product.data_inizio);
    var formattedDataFine = formatDate(product.data_fine);
    var quantita = product.quantita || 1; // Modifica qui
    var currentDate = new Date();
    var formattedCurrentDate = formatDate(currentDate.toISOString());

    var productRow = $('<div class="product "></div>');
    productRow.append('<div class="product-image"><img src="/static/images/' + immagine + '"></div>');
    productRow.append('<div class="product-details">' + product.id + '</div>');
    productRow.append('<div class="product-title">' + nome + '</div>');
    productRow.append('<div class="product-price">' + prezzo + '</div>');
    productRow.append('<div class="product-date1"><input type="date" value="' + formattedDataInizio + '" min="' + formattedCurrentDate + '"></div>');
    productRow.append('<div class="product-date2"><input type="date" value="' + formattedDataFine + '" min="' + formattedCurrentDate + '"></div>');
    productRow.append('<div class="product-quantity"><input type="number" value="' + quantita + '" min="1"></div>');
    productRow.append('<div class="product-removal"><button class="remove-product">Remove</button></div>');
    productRow.append('<div class="product-line-price">' + prezzo + '</div>');

    $('.shopping-cart').append(productRow);

    recalculateCart();
}

function formatDate(dateString) {
    if (!dateString) {
        return '';  // Restituisci una stringa vuota se la data è nulla o indefinita
    }

    var date = new Date(dateString);
    var year = date.getFullYear();
    var month = ('0' + (date.getMonth() + 1)).slice(-2);
    var day = ('0' + date.getDate()).slice(-2);

    return year + '-' + month + '-' + day;
}


function updateProduct(productRow) {
    // Estrae la quantità dal campo di input della quantità del prodotto nella riga
    var quantity = parseFloat(productRow.find('.product-quantity input').val()) || 0;
    // Calcola il prezzo totale del prodotto moltiplicando la quantità per il prezzo unitario
    // e per il numero di giorni, ottenuto dalla funzione contaGiorni
    var price = parseFloat(productRow.find('.product-price').text()) || 0;
    var data1 = productRow.find('.product-date1 input').val();
    var data2 = productRow.find('.product-date2 input').val();
    var data = contaGiorni(data1, data2);
    var linePrice = price * quantity * data;

    productRow.find('.product-line-price').fadeOut(fadeTime, function () {
        $(this).text(linePrice.toFixed(2));
        recalculateCart();
        $(this).fadeIn(fadeTime);
    });

    console.log(quantity, data1, data2, data, linePrice, productRow.find('.product-details').text());
    add_to_cart(productRow.find('.product-details').text(), quantity, data1, data2);

    productRow.find('.product-line-price').text(linePrice.toFixed(2));
}

function recalculateCart() {
    var subtotal = 0;

    $('.product').each(function () {
        subtotal += parseFloat($(this).find('.product-line-price').text()) || 0;
    });

    var tax = subtotal * taxRate;
    var shipping = (subtotal > 0 ? shippingRate : 0);
    var total = subtotal + tax + shipping;

    $('.totals-value').fadeOut(fadeTime, function () {
        $('#cart-subtotal').html(subtotal.toFixed(2));
        $('#cart-tax').html(tax.toFixed(2));
        $('#cart-shipping').html(shipping.toFixed(2));
        $('#cart-total').html(total.toFixed(2));
        if (total === 0) {
            $('.checkout').fadeOut(fadeTime);
        } else {
            $('.checkout').fadeIn(fadeTime);
        }
        $('.totals-value').fadeIn(fadeTime);
    });
}

/* Remove item from cart */

function replaceCart() {
    // Remove all products in the current cart
    $('.product').remove();

    // Add new products to the cart based on the new data
    currentCart.forEach(function (product) {
        drawCart(product);
    });
    console.log('Cart replaced');

}


function handleLogin(event) {
    event.preventDefault();

    var email = document.getElementById("lemail").value;
    var password = document.getElementById("lpassword").value;
    login(email, password);
}

function handleRegister(event) {
    event.preventDefault();

    var email = document.getElementById("remail").value;
    var password = document.getElementById("rpassword").value;

    register(email, password);
}





