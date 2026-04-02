import sys
import os

try:
    import docx
    doc = docx.Document(sys.argv[1])
    text = '\n'.join([para.text for para in doc.paragraphs])
    with open('prd.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Success")
except Exception as e:
    # Fallback to pure zipfile approach if python-docx is not installed
    import zipfile
    import xml.etree.ElementTree as ET
    
    try:
        z = zipfile.ZipFile(sys.argv[1])
        xml_content = z.read('word/document.xml')
        root = ET.fromstring(xml_content)
        
        # Word XML namespaces
        w_namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        text_lines = []
        for paragraph in root.iterfind('.//w:p', w_namespace):
            # Extract text from each run (w:r) in the paragraph
            para_text = ""
            for run in paragraph.iterfind('.//w:r', w_namespace):
                for text_node in run.iterfind('.//w:t', w_namespace):
                    if text_node.text:
                        para_text += text_node.text
            text_lines.append(para_text)
            
        with open('prd.txt', 'w', encoding='utf-8') as f:
            f.write('\n'.join(text_lines))
        print("Success (fallback)")
    except Exception as inner_e:
        print(f"Failed: {inner_e}")
