global using Patchouli.Core.Diagnostics;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.JSInterop;
using Patchouli.Core.Layout;
using Patchouli.Core.Bibliography;
using Patchouli.Infrastructure.Csl;
using System.Text.Json;
using Patchouli.Core.Documents;
using Patchouli.Core.Ids;
using Patchouli.Infrastructure.Documents;

WebAssemblyHost host = WebAssemblyHostBuilder.CreateDefault(args).Build();
await host.Services.GetRequiredService<IJSRuntime>().InvokeVoidAsync("patchouliCoreReady");
await host.RunAsync();

public static class BrowserDomain
{
    [JSInvokable]
    public static string ValidateBox(double x, double y, double width, double height)
    {
        var result = new NormalizedBBox(x, y, width, height).Validate();
        return result.IsFailure ? result.ErrorMessage ?? "invalid" : "ok";
    }

    [JSInvokable]
    public static string Identity() => $"{Patchouli.Core.BuildInfo.AppName} {Patchouli.Core.BuildInfo.Version}; schema {Patchouli.Core.AppSchemaVersion.Current}";

    [JSInvokable]
    public static IReadOnlyList<string> NormalizeTags(string[] tags) => TagNormalizer.NormalizeMany(tags);

    [JSInvokable]
    public static string RenderCsl(string styleXml, string itemsJson, string locale)
    {
        var items = JsonSerializer.Deserialize<List<Dictionary<string, object?>>>(itemsJson)
                    ?? throw new ArgumentException("Missing CSL items");
        var result = new FsharpCiteprocProcessor().Render(new FsharpCiteprocRenderRequest("browser-selected", styleXml, locale, items));
        if (result.IsFailure) throw new InvalidOperationException(result.ErrorMessage);
        return result.Value.RenderedText;
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [JSInvokable]
    public static string ValidateTree(string document, string page, string source, string boxesJson)
    {
        var revisionId = DocumentTreeRevisionId.New();
        var revision = new DocumentTreeRevision(revisionId, DocumentInstanceId.Parse(document), PageId.Parse(page), null,
            source, DocumentTreeRevisionStatus.Working, false, DateTimeOffset.UtcNow, null);
        var result = new DocumentTreeValidator(new MarkdigMarkdownEngine()).Validate(revision,
            MapBoxes(document, page, revisionId, boxesJson));
        return result.IsFailure ? result.ErrorMessage ?? "invalid" : "ok";
    }

    [JSInvokable]
    public static string CompilePage(string document, string page, string boxesJson)
    {
        var compiled = DocumentMarkdownRenderer.Render(MapBoxes(document, page, DocumentTreeRevisionId.New(), boxesJson),
            new MarkdigMarkdownEngine(), false, false, null);
        return compiled.Markdown;
    }

    private static DocumentBox[] MapBoxes(string document, string page, DocumentTreeRevisionId revision, string json)
    {
        var inputs = JsonSerializer.Deserialize<BrowserBox[]>(json, JsonOptions) ?? [];
        return inputs.Select(box => new DocumentBox(revision, DocumentBoxId.Parse(box.Id), DocumentInstanceId.Parse(document),
            PageId.Parse(page), box.Parent is null ? null : DocumentBoxId.Parse(box.Parent),
            box.Next is null ? null : DocumentBoxId.Parse(box.Next), box.Type, null, box.BaseType,
            new NormalizedBBox(box.X, box.Y, box.Width, box.Height),
            DocumentBoxPayloadSerializer.Deserialize(box.Type, box.BaseType, box.PayloadJson ?? JsonSerializer.Serialize(new { markdown = box.Text })),
            box.HeadingLevel, box.CodeLanguage, box.Confidence, box.Suppressed)).ToArray();
    }

    private sealed record BrowserBox(string Id, string Type, string? Parent, string? Next, string Text,
        double X, double Y, double Width, double Height, double? Confidence, bool Suppressed,
        string? BaseType = null, string? PayloadJson = null, int? HeadingLevel = null, string? CodeLanguage = null);
}
