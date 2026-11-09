using System.ComponentModel.DataAnnotations;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Contracts;

/// <summary>
/// Rejects text with control characters by the domain's rule (<see cref="TextRules"/>), so they are reported together
/// with the request's other field errors. Like the built-in attributes, it leaves a missing value to
/// <see cref="RequiredAttribute"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
internal sealed class NoControlCharactersAttribute : ValidationAttribute
{
    /// <summary>Whether line breaks and tabs are allowed, as in a description.</summary>
    public bool Multiline { get; set; }

    public override bool IsValid(object? value) => value is not string text || !TextRules.HasControlCharacter(text, Multiline);
}
