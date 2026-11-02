import Foundation
import PDFKit

guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: swift extract_pdf_lines.swift input.pdf output.json")
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let document = PDFDocument(url: inputURL) else {
    fatalError("Could not open PDF at \(inputURL.path)")
}

var rows = [[String: Any]]()
for pageIndex in 0..<document.pageCount {
    guard let page = document.page(at: pageIndex), let pageText = page.string else { continue }
    let text = pageText as NSString
    var offset = 0

    while offset < text.length {
        let range = text.lineRange(for: NSRange(location: offset, length: 0))
        let line = text.substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines)
        if !line.isEmpty {
            let bounds = page.selection(for: range)?.bounds(for: page) ?? .zero
            rows.append([
                "page": pageIndex + 1,
                "text": line,
                "x": Double(bounds.origin.x),
                "y": Double(bounds.origin.y),
                "width": Double(bounds.width),
                "height": Double(bounds.height)
            ])
        }
        offset = max(NSMaxRange(range), offset + 1)
    }
}

let data = try JSONSerialization.data(withJSONObject: rows, options: [.prettyPrinted, .sortedKeys])
try data.write(to: outputURL, options: .atomic)
print("Extracted \(rows.count) text lines from \(document.pageCount) pages")
