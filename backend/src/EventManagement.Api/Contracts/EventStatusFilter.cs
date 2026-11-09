using System.Text.Json.Serialization;

namespace EventManagement.Api.Contracts;

/// <summary>Which events a list request includes, relative to the current time. Bound case-insensitively.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<EventStatusFilter>))]
public enum EventStatusFilter
{
    /// <summary>Every event, in chronological order.</summary>
    [JsonStringEnumMemberName("all")]
    All,

    /// <summary>Events that haven't started yet, soonest first.</summary>
    [JsonStringEnumMemberName("upcoming")]
    Upcoming,

    /// <summary>Events that have started, most recent first.</summary>
    [JsonStringEnumMemberName("past")]
    Past,
}
