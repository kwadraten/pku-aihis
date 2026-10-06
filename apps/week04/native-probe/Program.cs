global using Patchouli.Core.Diagnostics;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using Patchouli.Core.Documents;
using Patchouli.Core.Ids;
using Patchouli.Core.Layout;
using Patchouli.Infrastructure.Documents;

if (args.Length is < 1 or > 2) throw new ArgumentException("Usage: NativeProbe <export.sqlite> [roundtrip-copy.sqlite]");
using var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = Path.GetFullPath(args[0]), Mode = SqliteOpenMode.ReadOnly }.ToString());
db.Open();
object? Scalar(string sql) { using var command = db.CreateCommand(); command.CommandText = sql; return command.ExecuteScalar(); }
if (!Equals(Scalar("pragma integrity_check"), "ok")) throw new InvalidDataException("Integrity failed");
using (var check = db.CreateCommand()) { check.CommandText = "pragma foreign_key_check"; using var reader = check.ExecuteReader(); if (reader.Read()) throw new InvalidDataException("Foreign keys failed"); }
if (Convert.ToInt32(Scalar("select schema_version from library_metadata")) != 2) throw new InvalidDataException("Wrong schema epoch");
var markdown = new MarkdigMarkdownEngine();
var validator = new DocumentTreeValidator(markdown);
var revisions = new List<DocumentTreeRevision>();
using (var query = db.CreateCommand())
{
    query.CommandText = "select * from document_tree_revisions where status='committed'";
    using var reader = query.ExecuteReader();
    while (reader.Read())
    {
        string S(string name) => reader.GetString(reader.GetOrdinal(name));
        string? N(string name) => reader.IsDBNull(reader.GetOrdinal(name)) ? null : S(name);
        revisions.Add(new DocumentTreeRevision(DocumentTreeRevisionId.Parse(S("tree_revision_id")), DocumentInstanceId.Parse(S("document_instance_id")), PageId.Parse(S("page_id")),
            N("parent_tree_revision_id") is { } parent ? DocumentTreeRevisionId.Parse(parent) : null,
            S("source"), S("status"), Convert.ToInt32(reader["is_current"]) == 1, DateTimeOffset.Parse(S("created_at")), DateTimeOffset.Parse(S("committed_at"))));
    }
}
var rendered = new List<object>();
foreach (var revision in revisions)
{
    var boxes = new List<DocumentBox>();
    using var query = db.CreateCommand(); query.CommandText = "select * from document_boxes where tree_revision_id=$rev"; query.Parameters.AddWithValue("$rev", revision.TreeRevisionId.ToString());
    using (var reader = query.ExecuteReader())
    {
        while (reader.Read())
        {
            string S(string name) => reader.GetString(reader.GetOrdinal(name));
            string? N(string name) => reader.IsDBNull(reader.GetOrdinal(name)) ? null : S(name);
            double D(string name) => Convert.ToDouble(reader[name]);
            boxes.Add(new DocumentBox(revision.TreeRevisionId, DocumentBoxId.Parse(S("box_id")), revision.DocumentInstanceId, revision.PageId,
                N("parent_box_id") is { } parent ? DocumentBoxId.Parse(parent) : null, N("next_sibling_box_id") is { } next ? DocumentBoxId.Parse(next) : null,
                S("box_type"), N("sub_type"), N("base_type"), new NormalizedBBox(D("bbox_x"), D("bbox_y"), D("bbox_width"), D("bbox_height")),
                DocumentBoxPayloadSerializer.Deserialize(S("box_type"), N("base_type"), N("payload_json")),
                reader["heading_level"] is DBNull ? null : Convert.ToInt32(reader["heading_level"]), N("code_language"), reader["confidence"] is DBNull ? null : D("confidence"), Convert.ToInt32(reader["suppressed"]) == 1));
        }
    }
    var validation = validator.Validate(revision, boxes);
    if (validation.IsFailure) throw new InvalidDataException($"{revision.TreeRevisionId}: {validation.ErrorMessage}");
    var output = DocumentMarkdownRenderer.Render(boxes, markdown, false, false, null);
    rendered.Add(new { revision = revision.TreeRevisionId.ToString(), current = revision.IsCurrent, boxes = boxes.Count, markdown = output.Markdown });
}
if(args.Length==2){
    var copy=Path.GetFullPath(args[1]);
    if(copy==Path.GetFullPath(args[0]))throw new ArgumentException("Roundtrip writes must use a separate copy");
    File.Copy(Path.GetFullPath(args[0]),copy,true);
    using var writable=new SqliteConnection(new SqliteConnectionStringBuilder{DataSource=copy,Mode=SqliteOpenMode.ReadWrite}.ToString());
    writable.Open();using var command=writable.CreateCommand();
    command.CommandText="update items set note='NATIVE_ROUNDTRIP_2026'";command.ExecuteNonQuery();
}
Console.WriteLine(JsonSerializer.Serialize(new
{
    mode = "native Microsoft.Data.Sqlite + unmodified Patchouli validator/compiler",
    integrity = "ok",
    foreign_keys = "ok",
    schema = 2,
    migrations = Convert.ToInt32(Scalar("select count(*) from schema_migrations")),
    items = Convert.ToInt32(Scalar("select count(*) from items")),
    revisions = rendered
}, new JsonSerializerOptions { WriteIndented = true }));
