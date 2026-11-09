using System.Diagnostics.CodeAnalysis;

namespace EventManagement.Api.Common;

/// <summary>The outcome of an operation that either succeeds or fails with an expected <see cref="Common.Error"/>.</summary>
public class Result
{
    private static readonly Result SuccessResult = new(null);

    private protected Result(Error? error) => Error = error;

    /// <summary>The failure, or <see langword="null"/> when the operation succeeded.</summary>
    public Error? Error { get; }

    /// <summary>Whether the operation succeeded. When <see langword="false"/>, <see cref="Error"/> is set.</summary>
    [MemberNotNullWhen(false, nameof(Error))]
    public bool IsSuccess => Error is null;

    /// <summary>A successful outcome without a value.</summary>
    public static Result Success() => SuccessResult;

    /// <summary>Wraps an error in a failed result.</summary>
    public static implicit operator Result(Error error) => new(error);
}

/// <summary>The outcome of an operation that either produces a <typeparamref name="T"/> or fails with an expected error.</summary>
/// <typeparam name="T">The type of the value produced on success.</typeparam>
public sealed class Result<T> : Result
{
    private readonly T? _value;

    private Result(T value) : base(null) => _value = value;

    private Result(Error error) : base(error)
    {
    }

    /// <summary>The value produced by a successful operation.</summary>
    /// <exception cref="InvalidOperationException">The result is a failure.</exception>
    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException($"A failed result has no value ({Error.Code}: {Error.Message}).");

    /// <summary>Creates a successful result.</summary>
    public static Result<T> Success(T value) => new(value);

    /// <summary>Transforms the value of a successful result; a failure is passed through unchanged.</summary>
    public Result<TOut> Map<TOut>(Func<T, TOut> map) =>
        IsSuccess ? Result<TOut>.Success(map(Value)) : Error;

    /// <summary>Wraps a value in a successful result.</summary>
    public static implicit operator Result<T>(T value) => new(value);

    /// <summary>Wraps an error in a failed result.</summary>
    public static implicit operator Result<T>(Error error) => new(error);
}
