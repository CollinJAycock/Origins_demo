using EventManagement.Api.Common;
using EventManagement.Api.Domain;

namespace EventManagement.Api.Tests.Support;

/// <summary>Assertions for <see cref="Result"/> values that report the actual error on failure.</summary>
internal static class ResultAssert
{
    public static void Success(Result result) =>
        Assert.True(result.IsSuccess, $"Expected success but got {result.Error?.Code}: {result.Error?.Message}");

    public static Error Failure(Result result, string expectedCode)
    {
        Assert.False(result.IsSuccess, $"Expected failure '{expectedCode}' but the result succeeded.");
        Assert.Equal(expectedCode, result.Error.Code);
        return result.Error;
    }

    public static void ValidationFailure(Result result, string field, string expectedMessage)
    {
        var error = Failure(result, ErrorCodes.ValidationFailed);
        Assert.Equal(ErrorType.Validation, error.Type);
        Assert.True(error.FieldErrors.TryGetValue(field, out var messages), $"No error for field '{field}'.");
        Assert.Contains(expectedMessage, messages);
    }
}
