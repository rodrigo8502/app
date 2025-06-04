import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, where, getDoc, doc, setDoc } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Importa seu novo arquivo CSS personalizado
import './styles/App.css';

// Variáveis globais fornecidas pelo ambiente Canvas
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// SEU OBJETO firebaseConfig HARDCODED (APENAS ESTA CÓPIA DEVE EXISTIR)
const firebaseConfig = {
  apiKey: "AIzaSyAHa-yRkk64xJWoqNl2dIgCXpK3zlomtDQ",
  authDomain: "project1-7ae99.firebaseapp.com",
  projectId: "project1-7ae99",
  storageBucket: "project1-7ae99.firebasestorage.app",
  messagingSenderId: "69681239386",
  appId: "1:69681239386:web:072c2ad0b589e6ce730f63",
  measurementId: "G-1YDWWBG40B"
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Componente principal do aplicativo
function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentHobby, setCurrentHobby] = useState('');
  const [hobbyInput, setHobbyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false); // Estado para o modo escuro
  const messagesEndRef = useRef(null);

  // Efeito para inicializar o Firebase e autenticar o usuário
  // A inicialização principal do app Firebase acontece AQUI dentro do useEffect, APENAS UMA VEZ
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig); // Inicializa com sua config hardcoded
      getAnalytics(app); // Inicializa o Analytics aqui
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const storedUsername = localStorage.getItem('chatUsername');
      if (storedUsername) {
        setUsername(storedUsername);
      }

      // Carrega o estado do modo escuro do localStorage
      const storedDarkMode = localStorage.getItem('darkMode');
      if (storedDarkMode !== null) {
        setIsDarkMode(JSON.parse(storedDarkMode));
      }

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        // --- INÍCIO DOS CONSOLE.LOGS DE AUTENTICAÇÃO ADICIONADOS AQUI ---
        console.log('--- Depuração Autenticação ---');
        console.log('user object from onAuthStateChanged:', user);
        if (user) {
          console.log('User authenticated with UID:', user.uid);
          setUserId(user.uid);
          setLoading(false);
        } else {
          console.log('No user authenticated, attempting sign-in...');
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
              console.log('Signed in with custom token.');
            } else {
              await signInAnonymously(firebaseAuth);
              console.log('Signed in anonymously.');
            }
          } catch (error) {
            console.error("Erro na autenticação:", error);
            setLoading(false);
          }
        }
        console.log('---------------------------');
        // --- FIM DOS CONSOLE.LOGS DE AUTENTICAÇÃO ADICIONADOS AQUI ---
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Erro ao inicializar o Firebase:", error);
      setLoading(false);
    }
  }, []); // Array de dependências vazio para rodar apenas uma vez na montagem

  // Efeito para aplicar a classe 'dark-mode' ao body e salvar no localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Efeito para buscar mensagens quando o hobby ou o DB/Auth mudam
  useEffect(() => {
    if (!db || !auth || !userId || !currentHobby) {
      return;
    }

    const q = query(
      collection(db, `artifacts/${appId}/public/data/messages`),
      where("hobbyId", "==", currentHobby)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedMessages.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return a.timestamp.toDate() - b.timestamp.toDate();
        }
        return 0;
      });
      setMessages(fetchedMessages);
      scrollToBottom();
    }, (error) => {
      console.error("Erro ao buscar mensagens:", error);
    });

    return () => unsubscribe();
  }, [db, auth, userId, currentHobby]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // APENAS UMA CÓPIA DA FUNÇÃO sendMessage
  const sendMessage = async () => {
    // ESTES SÃO OS console.log's QUE EU TE PEDIMOS PARA DEPURAR
    console.log('--- Depuração sendMessage ---');
    console.log('newMessage:', newMessage);
    console.log('db:', db);
    console.log('userId:', userId);
    console.log('currentHobby:', currentHobby);
    console.log('username:', username);
    console.log('---------------------------');

    if (newMessage.trim() === '' || !db || !userId || !currentHobby || username.trim() === '') {
      console.log('Por favor, defina um nome de usuário e digite sua mensagem.');
      return;
    }

    try {
      const hobbyRef = doc(db, `artifacts/${appId}/public/data/hobbies`, currentHobby);
      const hobbyDocSnap = await getDoc(hobbyRef);

      if (!hobbyDocSnap.exists()) {
        await setDoc(hobbyRef, { name: currentHobby });
      }

      await addDoc(collection(db, `artifacts/${appId}/public/data/messages`), {
        text: newMessage,
        userId: userId,
        username: username,
        hobbyId: currentHobby,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  const handleSelectHobby = () => {
    if (hobbyInput.trim() !== '') {
      setCurrentHobby(hobbyInput.trim().toLowerCase());
      setHobbyInput('');
    }
  };

  const setAndSaveUsername = () => {
    if (usernameInput.trim() !== '') {
      setUsername(usernameInput.trim());
      localStorage.setItem('chatUsername', usernameInput.trim());
      setUsernameInput('');
    } else {
      console.log('O nome de usuário não pode estar vazio.');
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="app-main-container">
      <div className="chat-window">
        <h1 className="chat-title">
          Chat de Hobbies
        </h1>

        <div className="user-id-display">
          Seu ID de Usuário: <span>{userId}</span>
        </div>

        <div className="input-section">
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder={username ? `Seu nome atual: ${username}` : "Escolha seu nome de usuário"}
            className="text-input"
            onKeyPress={(e) => { if (e.key === 'Enter') setAndSaveUsername(); }}
          />
          <button
            onClick={setAndSaveUsername}
            className="base-button button-purple"
          >
            {username ? 'Mudar Nome' : 'Definir Nome'}
          </button>
        </div>

        {username && (
            <div className="username-greeting">
                Olá, <span className="capitalize">{username}!</span>
            </div>
        )}

        <div className="input-section">
          <input
            type="text"
            value={hobbyInput}
            onChange={(e) => setHobbyInput(e.target.value)}
            placeholder="Digite o nome do hobby (ex: jardinagem)"
            className="text-input"
            onKeyPress={(e) => { if (e.key === 'Enter') handleSelectHobby(); }}
          />
          <button
            onClick={handleSelectHobby}
            className="base-button button-blue"
          >
            Selecionar Hobby
          </button>
        </div>

        {currentHobby && (
          <h2 className="current-hobby-title">
            Hobby Atual: <span className="capitalize">{currentHobby}</span>
          </h2>
        )}

        <div className="messages-area custom-scrollbar">
          {currentHobby ? (
            messages.length > 0 ? (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message-item ${msg.userId === userId ? 'own-message' : 'other-message'}`}
                >
                  <div
                    className={`message-bubble ${
                      msg.userId === userId
                        ? 'own-message-bubble'
                        : 'other-message-bubble'
                    }`}
                  >
                    <div className="message-username">
                      {msg.userId === userId ? (
                          'Você'
                      ) : (
                          `${msg.username || 'Usuário Desconhecido'} (ID: ${msg.userId.substring(0, 8)}...)`
                      )}
                    </div>
                    <p className="message-text">{msg.text}</p>
                    {msg.timestamp && (
                      <div className="message-timestamp">
                        {new Date(msg.timestamp.toDate()).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="no-messages-text">
                Nenhuma mensagem para este hobby ainda. Seja o primeiro a enviar!
              </p>
            )
          ) : (
            <p className="no-messages-text">
              Selecione um hobby para começar a conversar.
            </p>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="message-input-section">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={currentHobby ? "Digite sua mensagem..." : "Selecione um hobby primeiro"}
            className="text-input"
            disabled={!currentHobby || !username}
            onKeyPress={(e) => { if (e.key === 'Enter') sendMessage(); }}
          />
          <button
            onClick={sendMessage}
            className="base-button button-green"
            disabled={!currentHobby || !username}
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Botão para alternar modo escuro */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="dark-mode-toggle-button"
      >
        {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
      </button>
    </div>
  );
}

export default App;