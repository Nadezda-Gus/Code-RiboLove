module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/js/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        fish: {
          yellow: "#ffd60a",
          yellowSoft: "#FFFF2A",
          purple: "#6a0dad",
          purpleLight: "#b15dff",
          purplePale: "#c77dff",
          bg: "#f4f4f4",
        },
      },
      fontFamily: {
        logo: ["FishFont", "cursive"],
      },
    },
  },
  plugins: [],
};