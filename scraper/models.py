from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class SottoEvento:
    titolo: str
    data_inizio: str
    data_fine: str
    date_testuali: Optional[str] = None
    luogo: Optional[str] = None
    url: Optional[str] = None
    descrizione: Optional[str] = None
    immagine: Optional[str] = None
    ora_inizio: Optional[str] = None
    ora_fine: Optional[str] = None
    artisti: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    is_ingresso_gratuito: bool = False

    # Campi arricchiti dallo schema AI unificato (v2.0)
    categoria: Optional[str] = None
    is_evento: bool = True
    link_organizzatore: Optional[str] = None
    link_biglietti: Optional[str] = None
    dettagli_dominio: Optional[dict] = None
    bio_artisti: List[dict] = field(default_factory=list)
    social_contatti: List[str] = field(default_factory=list)

@dataclass
class Evento:
    titolo: str
    data_inizio: Optional[str] = None
    data_fine: Optional[str] = None
    date_testuali: Optional[str] = None
    luogo: Optional[str] = None
    provincia: Optional[str] = None
    descrizione: Optional[str] = None
    url: Optional[str] = None
    fonte: Optional[str] = None
    categoria: Optional[str] = None
    immagine: Optional[str] = None

    testo_estratto: Optional[str] = None
    is_festival: bool = False
    is_ingresso_gratuito: bool = False
    sotto_eventi: List[SottoEvento] = field(default_factory=list)
    dettagli_extra: dict = field(default_factory=dict)
    parent_id: Optional[int] = None  # Impostato dal runner per gli eventi figli

    # Campi arricchiti (da AI o scraper specializzati)
    ora_inizio: Optional[str] = None
    ora_fine: Optional[str] = None
    link_biglietti: Optional[str] = None
    link_organizzatore: Optional[str] = None
    artisti: List[str] = field(default_factory=list)
    bio_artisti: List[dict] = field(default_factory=list)
    social_contatti: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    is_evento: bool = True
    dettagli_dominio: Optional[dict] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}

    def __str__(self) -> str:
        parti = [f"📅 {self.titolo}"]
        if self.data_inizio:
            parti.append(f"   Data:     {self.data_inizio}")
        if self.data_fine and self.data_fine != self.data_inizio:
            parti.append(f"   Fine:     {self.data_fine}")
        if self.ora_inizio:
            parti.append(f"   Ore:      {self.ora_inizio}")
        if self.luogo:
            parti.append(f"   Luogo:    {self.luogo}")
        if self.provincia:
            parti.append(f"   Prov.:    {self.provincia}")
        if self.categoria:
            parti.append(f"   Categ.:   {self.categoria}")
        if self.artisti:
            parti.append(f"   Artisti:  {', '.join(self.artisti)}")
        if self.url:
            parti.append(f"   Link:     {self.url}")
        return "\n".join(parti)
