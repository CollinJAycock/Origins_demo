using System.ComponentModel.DataAnnotations;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Contracts;

/// <summary>
/// Requires text to have a visible character, the domain's rule for required text (<see cref="TextRules"/>), so text
/// made only of invisible characters is reported together with the request's other field errors. Like the built-in
/// attributes, it leaves a missing value to <see cref="RequiredAttribute"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
internal sealed class VisibleTextAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value is not string text || TextRules.HasVisibleCharacter(text);
}
