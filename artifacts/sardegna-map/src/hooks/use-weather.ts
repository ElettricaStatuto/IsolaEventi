import React, { useEffect, useState } from "react";

/**
 * Previsione meteo per un evento, via Open-Meteo (gratuito, nessuna chiave
 * richiesta per uso non commerciale). Le previsioni sono affidabili solo
 * per i prossimi ~16 giorni: oltre quella finestra (o per un evento gia'
 * passato) non chiediamo nulla e il chiamante non mostra alcun indicatore -
 * meglio nessuna previsione che una indovinata.
 */

export interface WeatherInfo {
  weatherCode: number;
  icon: string;
  descrizione: string;
  tempMax: number;
  tempMin: number;
}

const GIORNI_MASSIMI_PREVISIONE = 16;

// Codici WMO (usati da Open-Meteo) -> icona + descrizione in italiano.
const WMO: Record<number, { icon: string; descrizione: string }> = {
  0: { icon: "☀️", descrizione: "Sereno" },
  1: { icon: "🌤️", descrizione: "Prevalentemente sereno" },
  2: { icon: "⛅", descrizione: "Parzialmente nuvoloso" },
  3: { icon: "☁️", descrizione: "Coperto" },
  45: { icon: "🌫️", descrizione: "Nebbia" },
  48: { icon: "🌫️", descrizione: "Nebbia con brina" },
  51: { icon: "🌦️", descrizione: "Pioviggine leggera" },
  53: { icon: "🌦️", descrizione: "Pioviggine moderata" },
  55: { icon: "🌧️", descrizione: "Pioviggine intensa" },
  56: { icon: "🌧️", descrizione: "Pioviggine gelata leggera" },
  57: { icon: "🌧️", descrizione: "Pioviggine gelata intensa" },
  61: { icon: "🌦️", descrizione: "Pioggia leggera" },
  63: { icon: "🌧️", descrizione: "Pioggia moderata" },
  65: { icon: "🌧️", descrizione: "Pioggia intensa" },
  66: { icon: "🌧️", descrizione: "Pioggia gelata leggera" },
  67: { icon: "🌧️", descrizione: "Pioggia gelata intensa" },
  71: { icon: "🌨️", descrizione: "Neve leggera" },
  73: { icon: "🌨️", descrizione: "Neve moderata" },
  75: { icon: "❄️", descrizione: "Neve intensa" },
  77: { icon: "❄️", descrizione: "Granelli di neve" },
  80: { icon: "🌦️", descrizione: "Rovesci leggeri" },
  81: { icon: "🌧️", descrizione: "Rovesci moderati" },
  82: { icon: "⛈️", descrizione: "Rovesci violenti" },
  85: { icon: "🌨️", descrizione: "Rovesci di neve leggeri" },
  86: { icon: "❄️", descrizione: "Rovesci di neve intensi" },
  95: { icon: "⛈️", descrizione: "Temporale" },
  96: { icon: "⛈️", descrizione: "Temporale con grandine leggera" },
  99: { icon: "⛈️", descrizione: "Temporale con grandine intensa" },
};

function dentroFinestraPrevisione(dataIso: string): boolean {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const target = new Date(dataIso + "T00:00:00");
  const giorni = Math.round((target.getTime() - oggi.getTime()) / 86400000);
  return giorni >= 0 && giorni <= GIORNI_MASSIMI_PREVISIONE;
}

export function useWeather(
  latitudine: number | null | undefined,
  longitudine: number | null | undefined,
  dataInizio: string | null | undefined
): WeatherInfo | null {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    setWeather(null);
    if (latitudine == null || longitudine == null || !dataInizio) return;
    if (!dentroFinestraPrevisione(dataInizio)) return;

    const controller = new AbortController();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitudine}&longitude=${longitudine}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FRome` +
      `&start_date=${dataInizio}&end_date=${dataInizio}`;

    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const code = data?.daily?.weathercode?.[0];
        const tempMax = data?.daily?.temperature_2m_max?.[0];
        const tempMin = data?.daily?.temperature_2m_min?.[0];
        if (code == null || tempMax == null || tempMin == null) return;
        const meta = WMO[code] || { icon: "🌡️", descrizione: "N/D" };
        setWeather({ weatherCode: code, icon: meta.icon, descrizione: meta.descrizione, tempMax, tempMin });
      })
      .catch(() => {
        // Previsione non disponibile: nessun indicatore, nessun errore mostrato.
      });

    return () => controller.abort();
  }, [latitudine, longitudine, dataInizio]);

  return weather;
}

/**
 * Piccolo badge pronto all'uso per liste (`.map()`) dove l'hook non puo'
 * essere chiamato direttamente nel corpo del ciclo: essendo un componente
 * a se', ogni card ha la propria chiamata a useWeather senza violare le
 * regole degli hook. Non renderizza nulla se la previsione non e' disponibile.
 */
export function WeatherBadge({
  latitudine,
  longitudine,
  dataInizio,
  className,
}: {
  latitudine: number | null | undefined;
  longitudine: number | null | undefined;
  dataInizio: string | null | undefined;
  className?: string;
}) {
  const weather = useWeather(latitudine, longitudine, dataInizio);
  if (!weather) return null;
  return React.createElement(
    "span",
    { className, title: weather.descrizione },
    `${weather.icon} ${Math.round(weather.tempMax)}°/${Math.round(weather.tempMin)}°`
  );
}
