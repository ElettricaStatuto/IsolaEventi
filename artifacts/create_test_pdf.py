from fpdf import FPDF

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=15)
pdf.cell(200, 10, txt="Sagra della Bistecca, 15 Agosto, Alghero", ln=1, align='C')
pdf.cell(200, 10, txt="Concerto dei Tazenda, 16 Agosto, Sassari", ln=2, align='C')
pdf.output("test_event.pdf")
