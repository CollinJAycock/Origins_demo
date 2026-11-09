using System.Globalization;
using System.Text;

namespace EventManagement.Api.Domain;

/// <summary>
/// Character rules for trimmed text fields. They keep out characters that change how text is laid out or displayed
/// instead of adding to it, and text that would display as nothing at all.
/// </summary>
internal static class TextRules
{
    /// <summary>
    /// Whether <paramref name="text"/> contains a control character: Unicode category Cc (which includes tabs and
    /// line breaks), or a bidirectional embedding, override or isolate character. <paramref name="multiline"/> text
    /// may contain line feeds, carriage returns and tabs.
    /// </summary>
    public static bool HasControlCharacter(string text, bool multiline = false) =>
        text.Any(character =>
            (char.IsControl(character) && !(multiline && character is '\n' or '\r' or '\t')) || IsBidiControl(character));

    /// <summary>
    /// Whether <paramref name="text"/> has at least one visible character: one that isn't invisible (see
    /// <see cref="IsInvisible"/>) and isn't a combining mark, which only shows on top of another character.
    /// </summary>
    public static bool HasVisibleCharacter(string text) =>
        // By rune rather than char: some invisible characters, such as the tag characters, are outside the BMP.
        text.EnumerateRunes().Any(rune =>
            !IsInvisible(rune)
            && Rune.GetUnicodeCategory(rune) is not (UnicodeCategory.NonSpacingMark or UnicodeCategory.EnclosingMark));

    /// <summary>
    /// Whether <paramref name="rune"/> displays as nothing, or as blank space: whitespace, control characters (Cc),
    /// format characters (Cf, such as zero-width spaces and soft hyphens), the other code points that Unicode says
    /// to display as nothing (default ignorable code points, such as variation selectors and the Hangul fillers),
    /// and the blank Braille pattern.
    /// </summary>
    public static bool IsInvisible(Rune rune) =>
        Rune.IsWhiteSpace(rune)
        || Rune.GetUnicodeCategory(rune) is UnicodeCategory.Control or UnicodeCategory.Format
        || rune.Value is 0x034F // combining grapheme joiner
            or 0x115F or 0x1160 or 0x3164 or 0xFFA0 // Hangul fillers
            or 0x17B4 or 0x17B5 // Khmer inherent vowels
            or (>= 0x180B and <= 0x180F) // Mongolian free variation selectors
            or (>= 0xFE00 and <= 0xFE0F) // variation selectors
            or (>= 0xE0000 and <= 0xE0FFF) // tag characters and more variation selectors
            or 0x2065 or (>= 0xFFF0 and <= 0xFFF8) // reserved for future invisible characters
            or 0x2800; // Braille pattern blank

    // U+202A–U+202E and U+2066–U+2069 make text display in a different order than it is stored, for example a name
    // shown reversed. Other format characters are allowed: zero-width joiners, for one, build emoji sequences.
    private static bool IsBidiControl(char character) =>
        character is (>= '\u202A' and <= '\u202E') or (>= '\u2066' and <= '\u2069');
}
