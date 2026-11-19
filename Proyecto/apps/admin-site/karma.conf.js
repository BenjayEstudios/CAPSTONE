// Config de Karma. ChromeHeadlessCI corre sin sandbox (necesario en Docker/CI).
// Locale: `ng test --watch=false` usa ChromeHeadlessCI; para ver el navegador
// usa `ng test --browsers=Chrome`.
// Si no hay CHROME_BIN y existe Chromium del sistema (contenedores Linux), lo usa.
if (!process.env.CHROME_BIN) {
  const chromium = "/usr/bin/chromium";
  if (require("fs").existsSync(chromium)) process.env.CHROME_BIN = chromium;
}

module.exports = function (config) {
  config.set({
    basePath: "",
    frameworks: ["jasmine", "@angular-devkit/build-angular"],
    plugins: [
      require("karma-jasmine"),
      require("karma-chrome-launcher"),
      require("@angular-devkit/build-angular/plugins/karma")
    ],
    client: { jasmine: { random: true } },
    reporters: ["progress"],
    browsers: ["ChromeHeadlessCI"],
    customLaunchers: {
      ChromeHeadlessCI: { base: "ChromeHeadless", flags: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] }
    },
    restartOnFileChange: true
  });
};
