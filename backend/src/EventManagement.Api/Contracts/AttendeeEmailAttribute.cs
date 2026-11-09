using System.ComponentModel.DataAnnotations;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Contracts;

/// <summary>
/// Checks an email address with the domain's own rule, so model validation accepts exactly the addresses the domain
/// does and reports a bad one together with the request's other field errors. Like the built-in attributes, it
/// leaves a missing value to <see cref="RequiredAttribute"/>.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
internal sealed class AttendeeEmailAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value is not string email || EmailAddresses.IsValid(email);
}
