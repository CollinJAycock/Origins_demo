namespace EventManagement.Api.Contracts;

/// <summary>One page of a larger result set.</summary>
/// <typeparam name="T">The item type.</typeparam>
/// <param name="Items">The items on this page; empty when the page is past the end.</param>
/// <param name="Page">The 1-based page number.</param>
/// <param name="PageSize">The maximum number of items per page.</param>
/// <param name="TotalCount">How many items match across all pages.</param>
public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    /// <summary>How many pages there are; 0 when nothing matches.</summary>
    public int TotalPages => (TotalCount + PageSize - 1) / PageSize;
}
