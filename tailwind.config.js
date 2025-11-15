/** @type {import('tailwindcss').Config} */
export default {
  // ATENCIÓN: Esta es la sección crítica.
  // Le dice a Tailwind que escanee TODOS los archivos .jsx, .js, .ts, etc.,
  // dentro de la carpeta 'src' y también el 'index.html'.
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}


