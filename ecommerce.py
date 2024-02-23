import json
import pymysql
from flask import Flask, flash, render_template, redirect, url_for, request, get_flashed_messages, jsonify, session
from flask_bcrypt import Bcrypt
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user

app = Flask(__name__)
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = '1234'
app.config['MYSQL_DB'] = 'products_db'
app.config['MYSQL_HOST'] = 'localhost'
app.config['SECRET_KEY'] = 'una-chiave-segreta-sicura-e-segreta'
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)


class User(UserMixin):
    def __init__(self, id, email):
        self.id = id
        self.email = email


@app.route('/')
def index():
    try:
        filters_json = request.args.get('filters')
        filters = {} if filters_json is None else json.loads(filters_json)

        search_term = request.args.get('search')

        with get_db_connection() as conn, conn.cursor() as cur:
            try:
                prodotti = cerca_prodotto(cur, filters, search_term)
            except Exception as e:
                return f"Errore: {str(e)}"

        if not prodotti:
            return "Nessun risultato trovato."

        return render_template('index.html', prodotti=prodotti, table_values=get_available_filters())

    except pymysql.Error as e:
        return f"Errore MySQL: {str(e)}"


@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    print(f"Email: {email}, Password: {password}")
    with get_db_connection() as conn, conn.cursor() as cur:
        query_check_existing_user = "SELECT id FROM utenti WHERE email = %s"
        cur.execute(query_check_existing_user, (email,))
        existing_user = cur.fetchone()

        if existing_user:
            flash('Email già in uso. Scegli un altro.', 'reg_error')
        else:
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

            # Insert new user into 'utenti' table
            query_insert_user = "INSERT INTO utenti (email, password) VALUES (%s, %s)"
            cur.execute(query_insert_user, (email, hashed_password))
            conn.commit()

            # Retrieve the newly created user's ID
            query_get_user_id = "SELECT id FROM utenti WHERE email = %s"
            cur.execute(query_get_user_id, (email,))
            user_id = cur.fetchone()['id']  # Fix: use [0] to get the actual ID value

            # Create a new cart for the user
            query_create_cart = "INSERT INTO carrello (id_cliente) VALUES (%s)"
            cur.execute(query_create_cart, (user_id,))
            conn.commit()

            # Create a new wishlist for the user
            query_create_wishlist = "INSERT INTO wishlist (id_cliente) VALUES (%s)"
            cur.execute(query_create_wishlist, (user_id,))
            conn.commit()

            # Create a new order for the user (assuming you have some default values for track and invoice)
            query_create_order = "INSERT INTO ordini (id_cliente, track, fattura) VALUES (%s, %s, %s)"
            cur.execute(query_create_order, (user_id, 'default_track', 'default_invoice'))
            conn.commit()

            flash('Registrazione effettuata con successo! Ora puoi effettuare il login.', 'reg_success')
            return redirect(url_for('index'))  # Redirect to index after successful registration

    return render_template('index.html', table_values={},
                           reg_messages=get_flashed_messages(category_filter=['reg_error', 'reg_success']))


from flask import jsonify


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    print(f"Email: {email}, Password: {password}")
    with get_db_connection() as conn, conn.cursor() as cur:
        query = "SELECT id, email, password FROM utenti WHERE email = %s"
        cur.execute(query, (email,))
        user_data = cur.fetchone()
        print(user_data)

        if user_data and bcrypt.check_password_hash(user_data['password'], password):
            user = User(user_data['id'], user_data['email'])
            login_user(user)

            flash('Login effettuato con successo!', 'login_success')

            response = jsonify({'redirect': url_for('index')})
            response.status_code = 200
            return response

        else:
            flash('Credenziali non valide', 'login_error')

    response = jsonify({'error': 'Credenziali non valide'})
    response.status_code = 401
    return response


@login_manager.user_loader
def load_user(user_id):
    with get_db_connection() as conn, conn.cursor() as cur:
        query = "SELECT * FROM utenti WHERE id = %s"
        cur.execute(query, (user_id,))
        user_data = cur.fetchone()

        if user_data:
            user = User(user_data['id'], user_data['email'])
            return user

    return None


# Aggiungi una variabile di contesto globale per rendere disponibile current_user nella barra di navigazione
@app.context_processor
def inject_user():
    return dict(current_user=current_user)


# Funzione di logout
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


# Pagina protetta
@app.route('/pagina_riservata')
@login_required
def pagina_riservata():
    return render_template('pagina_riservata.html')


@app.route('/prodotti/<string:id>')
def fetchById(id):
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM prodotti WHERE id = %s", (id,))
        result = cur.fetchone()
    return jsonify(result)


@app.route('/user/cart/add', methods=['POST'])
def add_to_cart():
    data = request.get_json()

    product_id = data.get('product_id')
    quantity = data.get('quantity')
    data_inizio = data.get('data1')
    data_fine = data.get('data2')

    # Verifica se le date sono stringhe vuote o None e assegnale a None in tal caso
    data_inizio = data_inizio.strip() if data_inizio and data_inizio.strip() else None
    data_fine = data_fine.strip() if data_fine and data_fine.strip() else None

    print(data_inizio, data_fine, quantity, product_id)

    if product_id is not None:
        with get_db_connection() as conn, conn.cursor() as cur:
            # Prova ad aggiornare la tupla esistente
            cur.execute(
                "UPDATE prodotti_cart SET data_inizio = %s, data_fine = %s, quantita = %s "
                "WHERE id_carrello = (SELECT id FROM carrello WHERE id_cliente = %s) AND id_prodotto = %s",
                (data_inizio, data_fine, quantity, current_user.id, product_id))

            if cur.rowcount == 0:
                # Se non esiste una tupla con la chiave primaria specificata, inserisci una nuova tupla
                cur.execute(
                    "INSERT INTO prodotti_cart (id_carrello, id_prodotto, data_inizio, data_fine, quantita) "
                    "VALUES ((SELECT id FROM carrello WHERE id_cliente = %s), %s, %s, %s, %s)",
                    (current_user.id, product_id, data_inizio, data_fine, quantity))

            conn.commit()

        response = {'success': True, 'message': 'Prodotto aggiunto o aggiornato nel carrello con successo'}
    else:
        response = {'success': False, 'message': 'Prodotto non trovato'}

    return jsonify(response)


def get_product_id_by_name(product_name):
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM prodotti WHERE nome = %s", (product_name,))
        result = cur.fetchone()
        if result:
            return result['id']
    return None


@app.route('/user/cart/remove', methods=['POST'])
@login_required
def remove_from_cart():
    data = request.get_json()

    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM prodotti_cart WHERE id_carrello = (SELECT id FROM carrello WHERE id_cliente = %s) AND "
                    "id_prodotto = %s",
                    (current_user.id, data['product_id']))
        conn.commit()

    response = {'success': True, 'message': 'Prodotto rimosso dal carrello con successo'}
    return jsonify(response)


@app.route('/checkout', methods=['POST'])
@login_required
def checkout():
    try:
        with get_db_connection() as conn:
            # Get the user's cart items
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id_prodotto, data_inizio, data_fine, quantita FROM prodotti_cart WHERE id_carrello = (SELECT id FROM carrello WHERE id_cliente = %s)",
                    (current_user.id,))
                cart_items = cur.fetchall()

            # Create a new order for the user
            with conn.cursor() as cur:
                cur.execute("INSERT INTO ordini (id_cliente, track, fattura) VALUES (%s, %s, %s)",
                            (current_user.id, 'tracking_number', 'invoice_number'))
                order_id = cur.lastrowid

                # Move items from cart to the new order
                for item in cart_items:
                    cur.execute(
                        "INSERT INTO prodotti_cart (id_ordine, id_prodotto, data_inizio, data_fine, quantita) VALUES (%s, %s, %s, %s, %s)",
                        (order_id, item['id_prodotto'], item['data_inizio'], item['data_fine'], item['quantita']))

                # Clear the user's cart
                cur.execute(
                    "DELETE FROM prodotti_cart WHERE id_carrello = (SELECT id FROM carrello WHERE id_cliente = %s)",
                    (current_user.id,))

            conn.commit()

        response = {'success': True, 'message': 'Checkout completed successfully'}
        return jsonify(response)

    except Exception as e:
        # Handle exceptions as needed
        response = {'success': False, 'message': f'Error during checkout: {str(e)}'}
        return jsonify(response), 500


@app.route('/user/cart', methods=['GET'])
@login_required
def get_user_cart():
    with get_db_connection() as conn, conn.cursor() as cur:
        query = '''
            SELECT p.*, pc.data_inizio, pc.data_fine, pc.quantita
            FROM prodotti_cart pc
            JOIN prodotti p ON pc.id_prodotto = p.id
            WHERE pc.id_carrello = (
                SELECT id
                FROM carrello
                WHERE id_cliente = %s
            );
        '''

        cur.execute(query, (current_user.id,))
        cart_data = cur.fetchall()
        print(cart_data, current_user.id)

    return jsonify(cart_data)


@app.route('/update_results', methods=['POST'])
def update_results():
    try:
        data = request.get_json()
        search_term = data.get('search_term')
        selected_filters = data.get('selected_filters')

        app.logger.debug('Search Term: %s', search_term)
        app.logger.debug('Selected Filters: %s', selected_filters)

        with get_db_connection() as conn, conn.cursor() as cur:
            try:
                prodotti = cerca_prodotto(cur, selected_filters, search_term)
            except Exception as e:
                app.logger.error('Errore durante la query: %s', str(e))
                return jsonify(error=str(e))

        if not prodotti:
            app.logger.debug('Nessun risultato trovato.')
            return jsonify(result="Nessun risultato trovato.")

        app.logger.debug('Risultati trovati: %s', prodotti)

        return jsonify(result=[{
            'id': prodotto['id'],
            'prodotto_nome': prodotto['prodotto_nome'],
            'prezzo': str(prodotto['prezzo']),  # Converte il Decimal in stringa
            'immagine': prodotto['immagine']
        } for prodotto in prodotti])

    except pymysql.Error as e:
        app.logger.error('Errore MySQL: %s', str(e))
        return jsonify(error=f"Errore MySQL: {str(e)}")


def get_available_filters():
    with get_db_connection() as conn, conn.cursor() as cur:
        table_name = 'prodotti'  # Specify the table name 'prodotti'

        # Retrieve column names for the specified table
        cur.execute("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s
            AND TABLE_NAME = %s
        """, (app.config['MYSQL_DB'], table_name))
        column_names = cur.fetchall()

        table_values = {}
        for column_name in column_names:
            column_name = column_name['COLUMN_NAME']
            values_query = f"SELECT DISTINCT {column_name} FROM {table_name} WHERE {column_name} IS NOT NULL"
            cur.execute(values_query)
            values = [row[column_name] for row in cur.fetchall()]
            if values:
                table_values[column_name] = {'values': values}

        return table_values


def cerca_prodotto(cur, filters_json, search_term):
    query = """
    SELECT
        p.id,
        p.nome AS prodotto_nome,
        p.prezzo,
        p.immagine
    FROM prodotti p
    WHERE 1
    """
    filters = json.loads(filters_json) if filters_json else {}

    valid_filters = {key: value for key, value in filters.items() if value is not None and value != ''}

    if search_term:
        query += " AND p.nome LIKE %(search_term)s"
        valid_filters['search_term'] = f"%{search_term}%"

    valid_filters_copy = valid_filters.copy()

    for key, value in valid_filters_copy.items():
        if key != 'search_term':
            if isinstance(value, list):
                query += f" AND {key} IN %(values_{key})s"
                valid_filters[f'values_{key}'] = tuple(value)
            else:
                query += f" AND {key} = %({key})s"

    print("Query senza eseguire: ", query)
    print("Valori dei filtri: ", valid_filters)

    # Utilizza cur.mogrify solo per ottenere la stringa della query
    query_string = cur.mogrify(query, valid_filters)
    print(f"Query eseguita: {query_string}")

    # Usa cur.execute con il dizionario corretto
    cur.execute(query, valid_filters)
    result = cur.fetchall()
    return result


@app.route('/send_message', methods=['POST'])
@login_required
def send_message():
    recipient_email = request.form.get('recipient')
    message_content = request.form.get('message')

    # Ottieni l'ID dell'utente destinatario
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM utenti WHERE email = %s", (recipient_email,))
        recipient_data = cur.fetchone()

        if not recipient_data:
            flash('Utente destinatario non trovato.', 'message_error')
            return redirect(url_for('index'))

        recipient_id = recipient_data['id']

    # Inserisci il messaggio nel database
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("""
            INSERT INTO messages (sender_id, recipient_id, content)
            VALUES (%s, %s, %s)
        """, (current_user.id, recipient_id, message_content))
        conn.commit()

    flash('Messaggio inviato con successo!', 'message_success')
    return redirect(url_for('index'))


def get_db_connection():
    return pymysql.connect(
        user=app.config['MYSQL_USER'],
        password=app.config['MYSQL_PASSWORD'],
        db=app.config['MYSQL_DB'],
        host=app.config['MYSQL_HOST'],
        cursorclass=pymysql.cursors.DictCursor
    )


if __name__ == '__main__':
    app.run(debug=True)
