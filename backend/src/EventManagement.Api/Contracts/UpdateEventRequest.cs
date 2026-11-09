namespace EventManagement.Api.Contracts;

/// <summary>The body of a request that replaces all editable fields of an existing event.</summary>
public sealed record UpdateEventRequest : EventRequest;
