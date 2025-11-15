/** @type {import('tailwindcss').Config} */
export default {
  // ATENCIÓN: Asegúrate de que las rutas sean correctas.
  content: [
    "./index.html",
    // Esta línea cubre TODO el código dentro de la carpeta 'src'
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

