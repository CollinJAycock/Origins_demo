namespace EventManagement.Api.Common;

/// <summary>String normalization shared by request contracts and the domain.</summary>
public static class StringExtensions
{
    /// <summary>Trims <paramref name="value"/>, returning <see langword="null"/> when nothing but whitespace remains.</summary>
    public static string? TrimToNull(this string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
