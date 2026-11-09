namespace EventManagement.Api.Contracts;

/// <summary>Criteria for listing events, built by <c>GET /api/events</c> from its individually bound query parameters.</summary>
/// <param name="Status">Which events to include.</param>
/// <param name="Search">Text to look for in the title or description, case-insensitively; blank means no filter.</param>
/// <param name="Page">The 1-based page number.</param>
/// <param name="PageSize">How many events to return per page.</param>
public sealed record EventListQuery(
    EventStatusFilter Status = EventStatusFilter.All,
    string? Search = null,
    int Page = 1,
    int PageSize = EventListQuery.DefaultPageSize)
{
    /// <summary>The page size used when none is requested.</summary>
    public const int DefaultPageSize = 20;

    /// <summary>The largest page size a client can request.</summary>
    public const int MaxPageSize = 100;

    /// <summary>The longest search term a client can send.</summary>
    public const int SearchMaxLength = 100;
}
