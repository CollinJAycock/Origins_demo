using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Net.Mail;

namespace EventManagement.Api.Domain;

/// <summary>
/// The rules for attendee email addresses. An address identifies its attendee, so the rules decide both which
/// spellings are accepted and when two of them belong to the same attendee.
/// </summary>
internal static class EmailAddresses
{
    /// <summary>Whether a trimmed email address is valid.</summary>
    public static bool IsValid(string email) => TryGetIdentityKey(email, out _);

    /// <summary>
    /// The key identifying the attendee behind a valid, trimmed email address. It ignores letter case and whether an
    /// internationalized domain is written in Unicode or in its ASCII form, so <c>Ada@Bücher.example</c> and
    /// <c>ada@xn--bcher-kva.example</c> have the same key.
    /// </summary>
    /// <exception cref="ArgumentException"><paramref name="email"/> is not a valid address.</exception>
    public static string IdentityKey(string email) =>
        TryGetIdentityKey(email, out var key) ? key : throw new ArgumentException("The email address is not valid.", nameof(email));

    private static bool TryGetIdentityKey(string email, [NotNullWhen(true)] out string? key)
    {
        key = null;

        // Whitespace and characters that display as nothing (zero-width spaces, soft hyphens, direction marks,
        // variation selectors, ...) would let an address be registered again under a spelling that looks the same.
        if (email.EnumerateRunes().Any(TextRules.IsInvisible))
        {
            return false;
        }

        // MailAddress also accepts display-name forms such as "Ada <ada@example.com>"; requiring the parsed address
        // to equal the input limits it to a bare address. A quoted local part ("ada"@example.com) and a trailing dot
        // on the domain (ada@example.com.) would be second spellings of a plain address.
        if (!MailAddress.TryCreate(email, out var address)
            || address.Address != email
            || address.User.StartsWith('"')
            || address.Host.EndsWith('.'))
        {
            return false;
        }

        string asciiDomain;
        try
        {
            asciiDomain = new IdnMapping().GetAscii(address.Host);
        }
        catch (ArgumentException)
        {
            // Not a valid domain name, for example because a label starts with a hyphen.
            return false;
        }

        key = $"{address.User.ToLowerInvariant()}@{asciiDomain.ToLowerInvariant()}";
        return true;
    }
}
