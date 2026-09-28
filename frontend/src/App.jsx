import {
  useEffect,
  useState
} from "react";

import Downloader
  from "./components/Downloader.jsx";

import {
  getHealth
} from "./services/api.js";


function LegalLayout({
  title,
  children
}) {

  return (
    <div className="app">

      <header className="topbar">

        <a
          href="/"
          className="logo"
          style={{
            textDecoration: "none",
            color: "inherit"
          }}
        >

          <span className="logo-mark">
            D
          </span>

          <span className="logo-text">
            Video
            <strong>
              DL
            </strong>
          </span>

        </a>

      </header>


      <main>

        <section className="about-section">

          <h1>
            {title}
          </h1>

          {children}

        </section>

      </main>


      <footer>

        <div className="footer-brand">

          <span>
            Video DL
          </span>

          <span>
            © {new Date().getFullYear()}
          </span>

        </div>


        <div className="footer-description">

          <span>
            Descarga únicamente contenido que
            tengas permitido descargar.
          </span>

        </div>


        <nav className="footer-links">

          <a href="/">
            Inicio
          </a>

          <a href="/terminos">
            Términos
          </a>

          <a href="/privacidad">
            Privacidad
          </a>

          <a href="/contacto">
            Contacto
          </a>

        </nav>

      </footer>

    </div>
  );
}


/* =====================================================
   TÉRMINOS
===================================================== */

function TermsPage() {

  return (
    <LegalLayout
      title="Términos de uso"
    >

      <p>
        Última actualización: septiembre de 2026.
      </p>

      <h2>
        1. Uso del servicio
      </h2>

      <p>
        Video DL es una herramienta destinada a
        procesar contenido disponible públicamente
        y generar archivos en formatos compatibles.
      </p>

      <p>
        El usuario es responsable de asegurarse de
        que tiene los derechos, permisos o autorización
        necesarios para descargar, guardar o utilizar
        cualquier contenido procesado mediante el
        servicio.
      </p>


      <h2>
        2. Uso responsable
      </h2>

      <p>
        No debes utilizar Video DL para infringir
        derechos de autor, derechos de propiedad
        intelectual, derechos de terceros o las
        condiciones de uso de las plataformas de
        origen.
      </p>


      <h2>
        3. Contenido de terceros
      </h2>

      <p>
        Video DL no reclama la propiedad sobre los
        contenidos que los usuarios procesan mediante
        el servicio.
      </p>

      <p>
        El usuario debe respetar las leyes aplicables
        y las condiciones establecidas por la plataforma
        donde se encuentre el contenido original.
      </p>


      <h2>
        4. Disponibilidad
      </h2>

      <p>
        El servicio puede ser modificado, actualizado
        o temporalmente suspendido para realizar
        mantenimiento, mejoras o solucionar problemas
        técnicos.
      </p>


      <h2>
        5. Publicidad
      </h2>

      <p>
        Video DL puede mostrar publicidad de terceros
        para ayudar a financiar la operación y
        mantenimiento del servicio.
      </p>


      <h2>
        6. Aceptación
      </h2>

      <p>
        Al utilizar Video DL, aceptas estos términos
        de uso. Si no estás de acuerdo con ellos,
        debes dejar de utilizar el servicio.
      </p>

    </LegalLayout>
  );
}


/* =====================================================
   PRIVACIDAD
===================================================== */

function PrivacyPage() {

  return (
    <LegalLayout
      title="Política de privacidad"
    >

      <p>
        Última actualización: septiembre de 2026.
      </p>


      <h2>
        1. Información que recopilamos
      </h2>

      <p>
        Video DL está diseñado para procesar las
        solicitudes realizadas por los usuarios.
        Dependiendo de la configuración del servicio,
        pueden registrarse datos técnicos necesarios
        para mantener la seguridad y funcionamiento
        de la plataforma.
      </p>


      <h2>
        2. URLs proporcionadas por el usuario
      </h2>

      <p>
        Cuando introduces una URL para procesar un
        contenido, esta información puede ser utilizada
        temporalmente para realizar la operación
        solicitada.
      </p>


      <h2>
        3. Archivos procesados
      </h2>

      <p>
        Los archivos generados durante una descarga
        pueden almacenarse temporalmente en los
        servidores utilizados por el servicio para
        completar la operación solicitada.
      </p>


      <h2>
        4. Publicidad
      </h2>

      <p>
        Video DL puede utilizar servicios de publicidad
        de terceros. Estos servicios pueden utilizar
        tecnologías como cookies u otros identificadores
        para mostrar anuncios y medir su rendimiento,
        de acuerdo con sus propias políticas.
      </p>


      <h2>
        5. Cookies
      </h2>

      <p>
        Algunos servicios utilizados por Video DL,
        incluyendo servicios de publicidad o análisis,
        pueden utilizar cookies o tecnologías similares.
      </p>


      <h2>
        6. Seguridad
      </h2>

      <p>
        Se aplican medidas técnicas razonables para
        proteger el funcionamiento del servicio y la
        información procesada.
      </p>


      <h2>
        7. Cambios en esta política
      </h2>

      <p>
        Esta política puede actualizarse cuando se
        incorporen nuevas funciones, servicios o
        requisitos legales.
      </p>

    </LegalLayout>
  );
}


/* =====================================================
   CONTACTO
===================================================== */

function ContactPage() {

  return (
    <LegalLayout
      title="Contacto"
    >

      <p>
        Si necesitas comunicarte con el responsable
        de Video DL, puedes utilizar el medio de
        contacto que se publique oficialmente en esta
        página.
      </p>


      <div
        className="info-card"
        style={{
          marginTop: "30px"
        }}
      >

        <div className="info-icon">
          ✉️
        </div>

        <div>

          <h2>
            Soporte
          </h2>

          <p>
            Próximamente se publicará aquí el correo
            oficial de contacto de Video DL.
          </p>

        </div>

      </div>


      <h2>
        Solicitudes relacionadas con privacidad
      </h2>

      <p>
        Para solicitar información relacionada con
        privacidad o el tratamiento de datos, utiliza
        el medio de contacto oficial que se indique
        cuando esté disponible.
      </p>

    </LegalLayout>
  );
}


/* =====================================================
   PÁGINA PRINCIPAL
===================================================== */

function HomePage() {

  const [health, setHealth] =
    useState(null);


  useEffect(() => {

    getHealth()
      .then(setHealth)
      .catch(() => {
        setHealth(null);
      });

  }, []);


  return (
    <div className="app">

      {/* =================================================
          CABECERA
      ================================================= */}

      <header className="topbar">

        <a
          href="/"
          className="logo"
          style={{
            textDecoration: "none",
            color: "inherit"
          }}
        >

          <span className="logo-mark">
            D
          </span>

          <span className="logo-text">
            Video
            <strong>
              DL
            </strong>
          </span>

        </a>


        <div className="tools-status">

          <span
            className={
              health?.ytDlp
                ? "tool online"
                : "tool offline"
            }
          >

            <span className="status-dot" />

            yt-dlp

          </span>


          <span
            className={
              health?.ffmpeg
                ? "tool online"
                : "tool offline"
            }
          >

            <span className="status-dot" />

            FFmpeg

          </span>

        </div>

      </header>


      {/* =================================================
          CONTENIDO
      ================================================= */}

      <main>


        {/* =================================================
            PUBLICIDAD SUPERIOR
        ================================================= */}

        <section
          className="ad-container ad-top"
          aria-label="Publicidad"
        >

          <div className="ad-placeholder">

            <span>
              PUBLICIDAD
            </span>

          </div>

        </section>


        {/* =================================================
            DESCARGADOR
        ================================================= */}

        <Downloader />


        {/* =================================================
            PUBLICIDAD INFERIOR
        ================================================= */}

        <section
          className="ad-container ad-bottom"
          aria-label="Publicidad"
        >

          <div className="ad-placeholder">

            <span>
              PUBLICIDAD
            </span>

          </div>

        </section>


        {/* =================================================
            INFORMACIÓN
        ================================================= */}

        <section className="info-section">

          <div className="info-card">

            <div className="info-icon">
              ⚡
            </div>

            <div>

              <h2>
                Descargas rápidas
              </h2>

              <p>
                Video DL utiliza herramientas de
                procesamiento para preparar tus
                archivos de forma rápida y sencilla.
              </p>

            </div>

          </div>


          <div className="info-card">

            <div className="info-icon">
              🎬
            </div>

            <div>

              <h2>
                MP4 y MP3
              </h2>

              <p>
                Puedes elegir entre diferentes
                formatos y opciones de calidad
                disponibles para cada contenido.
              </p>

            </div>

          </div>


          <div className="info-card">

            <div className="info-icon">
              🔒
            </div>

            <div>

              <h2>
                Uso responsable
              </h2>

              <p>
                Utiliza Video DL únicamente con
                contenido que tengas derecho a
                descargar, guardar o utilizar.
              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            DESCRIPCIÓN
        ================================================= */}

        <section className="about-section">

          <h2>
            ¿Qué es Video DL?
          </h2>

          <p>
            Video DL es una herramienta web para
            procesar contenido disponible públicamente
            y convertirlo a formatos compatibles para
            uso personal o cuando tengas autorización
            para descargarlo.
          </p>

          <p>
            El servicio permite seleccionar diferentes
            opciones de descarga dependiendo de las
            características disponibles en el contenido
            original.
          </p>

        </section>

      </main>


      {/* =================================================
          PIE DE PÁGINA
      ================================================= */}

      <footer>

        <div className="footer-brand">

          <span>
            Video DL
          </span>

          <span>
            © {new Date().getFullYear()}
          </span>

        </div>


        <div className="footer-description">

          <span>
            Descarga únicamente contenido que
            tengas permitido descargar.
          </span>

        </div>


        <nav className="footer-links">

          <a href="/terminos">
            Términos
          </a>

          <a href="/privacidad">
            Privacidad
          </a>

          <a href="/contacto">
            Contacto
          </a>

        </nav>

      </footer>

    </div>
  );
}


/* =====================================================
   ROUTER SIMPLE
===================================================== */

function App() {

  const path =
    window.location.pathname
      .toLowerCase()
      .replace(/\/+$/, "") || "/";


  if (path === "/terminos") {
    return <TermsPage />;
  }


  if (path === "/privacidad") {
    return <PrivacyPage />;
  }


  if (path === "/contacto") {
    return <ContactPage />;
  }


  return <HomePage />;
}


export default App;