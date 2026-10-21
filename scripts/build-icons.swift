// Mechanical icon sizing/compositing only; the existing logo artwork is unchanged.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = CGImageSourceCreateWithURL(root.appendingPathComponent("assets/spa-mountain-logo.png") as CFURL, nil)!
let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
let cropped = image.cropping(to: CGRect(x: 110, y: 210, width: 1160, height: 810))!
for size in [192, 512] {
    let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.setFillColor(CGColor(red: 19.0/255, green: 43.0/255, blue: 56.0/255, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: size, height: size))
    context.interpolationQuality = .high
    let s = Double(size)
    // Put the complete visible artwork within Android's central mask-safe circle.
    context.draw(cropped, in: CGRect(x: s * 0.14, y: s * 0.24, width: s * 0.72, height: s * 0.52))
    let destination = CGImageDestinationCreateWithURL(root.appendingPathComponent("assets/icon-\(size).png") as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, context.makeImage()!, nil)
    precondition(CGImageDestinationFinalize(destination))
}
