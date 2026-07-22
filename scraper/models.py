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
    sotto_eventi: List[SottoEvento] = field(default_factory=list)
    dettagli_extra: dict = field(default_factory=dict)
    parent_id: Optional[int] = None   # Impostato dal runner per gli eventi figli di un festival

    def to_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items()}

    def __str__(self) -> str:
        parti = [f"📅 {self.titolo}"]
        if self.data_inizio:
            parti.append(f"   Data:     {self.data_inizio}")
        if self.data_fine and self.data_fine != self.data_inizio:
            parti.append(f"   Fine:     {self.data_fine}")
        if self.luogo:
            parti.append(f"   Luogo:    {self.luogo}")
        if self.provincia:
            parti.append(f"   Prov.:    {self.provincia}")
        if self.categoria:
            parti.append(f"   Categ.:   {self.categoria}")
        if self.url:
            parti.append(f"   Link:     {self.url}")
        return "\n".join(parti)
