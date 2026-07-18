import re

filepath = "artifacts/sardegna-map/src/pages/admin.tsx"
content = open(filepath, encoding="utf-8").read()

# 1. State definition for inspectingEvent
state_decl = '  const [selectedPubAnalyzeIds, setSelectedPubAnalyzeIds] = useState<Set<number>>(new Set());'
new_state_decl = state_decl + '\n  const [inspectingEvent, setInspectingEvent] = useState<any | null>(null);'
content = content.replace(state_decl, new_state_decl)

# 2. Add openEventDetails function
reset_decl = '  const handleLogout = () => {'
open_details_fn = """  const openEventDetails = (ev: any, isPending: boolean) => {
    let subEvents: any[] = [];
    if (isPending) {
      subEvents = ev.sotto_eventi || [];
    } else {
      subEvents = publishedEvents
        .filter((child) => child.parent_id === ev.id)
        .map((child) => ({
          titolo: child.titolo.replace(`${ev.titolo} - `, ""),
          data_inizio: child.data_inizio,
          data_fine: child.data_fine,
          luogo: child.luogo,
        }));
    }
    setInspectingEvent({
      ...ev,
      is_pending: isPending,
      sub_events_list: subEvents,
    });
  };

  const handleLogout = () => {"""
content = content.replace(reset_decl, open_details_fn)

# 3. Add to handleLogout reset
content = content.replace('setSelectedPubAnalyzeIds(new Set());\n  };', 'setSelectedPubAnalyzeIds(new Set());\n    setInspectingEvent(null);\n  };')

# 4. TabsTrigger update
tabs_trigger_old = """          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="scraping">
              <Eye className="w-4 h-4 mr-1" /> Scraping
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Clock className="w-4 h-4 mr-1" /> In Attesa
            </TabsTrigger>
            <TabsTrigger value="published">
              <Database className="w-4 h-4 mr-1" /> Pubblicati
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <AlertTriangle className="w-4 h-4 mr-1" /> Scartati
            </TabsTrigger>
          </TabsList>"""

tabs_trigger_new = """          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="scraping">
              <Eye className="w-4 h-4 mr-1" /> Scraping
            </TabsTrigger>
            <TabsTrigger value="pending">
              <Clock className="w-4 h-4 mr-1" /> In Attesa
            </TabsTrigger>
            <TabsTrigger value="published">
              <Database className="w-4 h-4 mr-1" /> Pubblicati
            </TabsTrigger>
            <TabsTrigger value="analyzed">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Analizzati
            </TabsTrigger>
            <TabsTrigger value="rejected">
              <AlertTriangle className="w-4 h-4 mr-1" /> Scartati
            </TabsTrigger>
          </TabsList>"""
content = content.replace(tabs_trigger_old, tabs_trigger_new)

# 5. Add TabContent for value="analyzed" before value="rejected"
rejected_tab_start = '          {/* ── REJECTED TAB ── */}'
analyzed_tab_content = """          {/* ── ANALYZED TAB ── */}
          <TabsContent value="analyzed" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Eventi Analizzati</CardTitle>
                <CardDescription>
                  Visualizza tutti gli eventi che hanno una locandina analizzata e le relative informazioni estratte.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="overflow-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left text-xs font-semibold">Stato</th>
                        <th className="p-2 text-left text-xs font-semibold">Immagine</th>
                        <th className="p-2 text-left text-xs font-semibold">Titolo</th>
                        <th className="p-2 text-left text-xs font-semibold">Data</th>
                        <th className="p-2 text-left text-xs font-semibold">Fonte</th>
                        <th className="p-2 text-left text-xs font-semibold">Sotto-eventi</th>
                        <th className="p-2 text-left text-xs font-semibold">Azione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const analyzedPreview = previewEvents
                          .filter((ev) => ev.testo_estratto)
                          .map((ev) => ({ ...ev, is_pending: true, id_key: `prev-${ev.titolo}` }));
                        const analyzedPublished = publishedEvents
                          .filter((ev) => ev.testo_estratto)
                          .map((ev) => ({ ...ev, is_pending: false, id_key: `pub-${ev.id}` }));
                        const allAnalyzed = [...analyzedPreview, ...analyzedPublished];

                        if (allAnalyzed.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                Nessun evento analizzato trovato.
                              </td>
                            </tr>
                          );
                        }

                        return allAnalyzed.map((ev) => {
                          const img = imageUrl(ev);
                          const subCount = ev.is_pending
                            ? (ev.sotto_eventi?.length || 0)
                            : publishedEvents.filter((child) => child.parent_id === ev.id).length;

                          return (
                            <tr key={ev.id_key} className="border-t border-border hover:bg-muted/40">
                              <td className="p-2">
                                <Badge variant={ev.is_pending ? "secondary" : "default"} className={ev.is_pending ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : ""}>
                                  {ev.is_pending ? "In Attesa" : "Pubblicato"}
                                </Badge>
                              </td>
                              <td className="p-2">
                                {img ? (
                                  <img src={img} alt={ev.titolo} className="w-16 h-12 object-cover rounded border" loading="lazy" />
                                ) : (
                                  <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">—</div>
                                )}
                              </td>
                              <td className="p-2 font-medium max-w-xs truncate">
                                {ev.titolo}
                              </td>
                              <td className="p-2 text-muted-foreground whitespace-nowrap">
                                {ev.data_inizio ? new Date(ev.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                              </td>
                              <td className="p-2">
                                <Badge variant="outline">{ev.fonte}</Badge>
                              </td>
                              <td className="p-2">
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50">
                                  {subCount} sotto-eventi
                                </Badge>
                              </td>
                              <td className="p-2">
                                <Button variant="outline" size="sm" onClick={() => openEventDetails(ev, ev.is_pending)}>
                                  <Eye className="w-4 h-4 mr-1" /> Dettagli
                                </Button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── REJECTED TAB ── */}"""
content = content.replace(rejected_tab_start, analyzed_tab_content)

# 6. Add Detail Modal before the end of the return statement
modal_placeholder = "        {/* Global error */}"
modal_content = """        {/* Detail Modal */}
        {inspectingEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={inspectingEvent.is_pending ? "secondary" : "default"} className={inspectingEvent.is_pending ? "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200" : ""}>
                        {inspectingEvent.is_pending ? "In Attesa" : "Pubblicato"}
                      </Badge>
                      <Badge variant="outline">{inspectingEvent.fonte}</Badge>
                    </div>
                    <CardTitle className="text-lg font-bold mt-1">{inspectingEvent.titolo}</CardTitle>
                    <CardDescription>
                      {inspectingEvent.data_inizio ? new Date(inspectingEvent.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                      {inspectingEvent.data_fine && inspectingEvent.data_fine !== inspectingEvent.data_inizio ? ` - ${new Date(inspectingEvent.data_fine).toLocaleDateString("it-IT")}` : ""}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" onClick={() => setInspectingEvent(null)} className="h-8 w-8 p-0">
                    <XCircle className="w-6 h-6 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Image & Description */}
                <div className="flex flex-col sm:flex-row gap-4">
                  {imageUrl(inspectingEvent) && (
                    <img
                      src={imageUrl(inspectingEvent)!}
                      alt={inspectingEvent.titolo}
                      className="w-full sm:w-48 h-36 object-cover rounded-md border"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descrizione Originale</h4>
                    <p className="text-sm text-foreground line-clamp-6">{inspectingEvent.descrizione || "Nessuna descrizione fornita."}</p>
                  </div>
                </div>

                {/* Extracted Text */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Testo Estratto dalla Locandina</h4>
                  <div className="bg-muted p-4 rounded-md font-mono text-xs max-h-48 overflow-y-auto border whitespace-pre-wrap">
                    {inspectingEvent.testo_estratto || "Nessun testo estratto."}
                  </div>
                </div>

                {/* Sub-events (Sotto-eventi) */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Sotto-eventi Rilevati ({inspectingEvent.sub_events_list?.length || 0})
                  </h4>
                  {inspectingEvent.sub_events_list && inspectingEvent.sub_events_list.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {inspectingEvent.sub_events_list.map((se: any, idx: number) => (
                        <div key={idx} className="p-3 bg-muted/40 rounded-lg border border-border/50 text-sm">
                          <div className="font-semibold text-foreground">{se.titolo}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {se.data_inizio ? new Date(se.data_inizio).toLocaleDateString("it-IT") : "N/D"}
                              {se.data_fine && se.data_fine !== se.data_inizio ? ` - ${new Date(se.data_fine).toLocaleDateString("it-IT")}` : ""}
                            </span>
                            {se.luogo && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {se.luogo}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nessun sotto-evento rilevato o inserito.</p>
                  )}
                </div>
              </CardContent>
              
              <div className="p-4 border-t border-border flex justify-end">
                <Button onClick={() => setInspectingEvent(null)}>Chiudi</Button>
              </div>
            </Card>
          </div>
        )}

        {/* Global error */}"""
content = content.replace(modal_placeholder, modal_content)

open(filepath, "w", encoding="utf-8").write(content)
print("Analyzed page and modal successfully added")
