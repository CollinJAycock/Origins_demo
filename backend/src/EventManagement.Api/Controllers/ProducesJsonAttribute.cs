using System.Net.Mime;
using Microsoft.AspNetCore.Mvc;

namespace EventManagement.Api.Controllers;

/// <summary>Documents a successful <c>application/json</c> response body of type <typeparamref name="T"/>.</summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
internal sealed class ProducesJsonAttribute<T>(int statusCode)
    : ProducesResponseTypeAttribute<T>(statusCode, MediaTypeNames.Application.Json);
