using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Tests.Api;

/// <summary>Assertions for HTTP responses, in particular the problem details contract.</summary>
internal static class ApiAssert
{
    public static async Task<T> SuccessAsync<T>(HttpResponseMessage response, HttpStatusCode expectedStatus)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<T>();
        Assert.NotNull(body);
        return body;
    }

    /// <summary>Asserts an RFC 9457 response with the given status and <c>code</c>, always carrying a <c>traceId</c>.</summary>
    public static async Task<JsonElement> ProblemAsync(HttpResponseMessage response, HttpStatusCode expectedStatus, string expectedCode)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal((int)expectedStatus, problem.GetProperty("status").GetInt32());
        Assert.Equal(expectedCode, problem.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(problem.GetProperty("traceId").GetString()));
        return problem;
    }

    /// <summary>Asserts a 404/409 business problem and returns its human-readable <c>detail</c>.</summary>
    public static async Task<string?> DetailedProblemAsync(HttpResponseMessage response, HttpStatusCode expectedStatus, string expectedCode)
    {
        var problem = await ProblemAsync(response, expectedStatus, expectedCode);
        return problem.GetProperty("detail").GetString();
    }

    /// <summary>Asserts a 400 validation problem and returns its field errors.</summary>
    public static async Task<Dictionary<string, string[]>> ValidationProblemAsync(HttpResponseMessage response)
    {
        var problem = await ProblemAsync(response, HttpStatusCode.BadRequest, ErrorCodes.ValidationFailed);
        var errors = problem.GetProperty("errors").Deserialize<Dictionary<string, string[]>>();
        Assert.NotNull(errors);
        return errors;
    }
}
