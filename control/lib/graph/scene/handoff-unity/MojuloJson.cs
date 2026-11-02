// MojuloJson.cs - the least JSON the importer and the probe need (Unity's JsonUtility reads no free-form JSON): Parse
// gives Dictionary<string, object> / List<object> / double / string / bool / null; Write gives it back compact, keys
// sorted, numbers as the shortest round-trip text (a record a developer reads, the same bytes for the same record).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Mojulo.Handoff
{
    public static class Json
    {
        public static object Parse(string s)
        {
            int i = 0;
            var v = Value(s, ref i);
            Ws(s, ref i);
            if (i != s.Length) throw new FormatException("JSON: trailing text at " + i);
            return v;
        }

        static void Ws(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }

        static object Value(string s, ref int i)
        {
            Ws(s, ref i);
            if (i >= s.Length) throw new FormatException("JSON: unexpected end");
            char c = s[i];
            if (c == '{')
            {
                var d = new Dictionary<string, object>();
                i++; Ws(s, ref i);
                if (s[i] == '}') { i++; return d; }
                while (true)
                {
                    Ws(s, ref i);
                    var k = Str(s, ref i);
                    Ws(s, ref i);
                    if (s[i] != ':') throw new FormatException("JSON: ':' expected at " + i);
                    i++;
                    d[k] = Value(s, ref i);
                    Ws(s, ref i);
                    if (s[i] == ',') { i++; continue; }
                    if (s[i] == '}') { i++; return d; }
                    throw new FormatException("JSON: ',' or '}' expected at " + i);
                }
            }
            if (c == '[')
            {
                var l = new List<object>();
                i++; Ws(s, ref i);
                if (s[i] == ']') { i++; return l; }
                while (true)
                {
                    l.Add(Value(s, ref i));
                    Ws(s, ref i);
                    if (s[i] == ',') { i++; continue; }
                    if (s[i] == ']') { i++; return l; }
                    throw new FormatException("JSON: ',' or ']' expected at " + i);
                }
            }
            if (c == '"') return Str(s, ref i);
            if (s.Length - i >= 4 && string.CompareOrdinal(s, i, "true", 0, 4) == 0) { i += 4; return true; }
            if (s.Length - i >= 5 && string.CompareOrdinal(s, i, "false", 0, 5) == 0) { i += 5; return false; }
            if (s.Length - i >= 4 && string.CompareOrdinal(s, i, "null", 0, 4) == 0) { i += 4; return null; }
            int a = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            if (a == i) throw new FormatException("JSON: unexpected '" + c + "' at " + i);
            return double.Parse(s.Substring(a, i - a), NumberStyles.Float, CultureInfo.InvariantCulture);
        }

        static string Str(string s, ref int i)
        {
            if (s[i] != '"') throw new FormatException("JSON: string expected at " + i);
            i++;
            var b = new StringBuilder();
            while (s[i] != '"')
            {
                char c = s[i++];
                if (c != '\\') { b.Append(c); continue; }
                char e = s[i++];
                switch (e)
                {
                    case 'n': b.Append('\n'); break;
                    case 't': b.Append('\t'); break;
                    case 'r': b.Append('\r'); break;
                    case 'b': b.Append('\b'); break;
                    case 'f': b.Append('\f'); break;
                    case 'u': b.Append((char)Convert.ToInt32(s.Substring(i, 4), 16)); i += 4; break;
                    default: b.Append(e); break;
                }
            }
            i++;
            return b.ToString();
        }

        public static string Write(object v)
        {
            var b = new StringBuilder();
            Write(b, v);
            return b.ToString();
        }

        static void Write(StringBuilder b, object v)
        {
            switch (v)
            {
                case null: b.Append("null"); break;
                case bool x: b.Append(x ? "true" : "false"); break;
                case string x: Quote(b, x); break;
                case double x: b.Append(Num(x)); break;
                case float x: b.Append(Num(x)); break;
                case int x: b.Append(x.ToString(CultureInfo.InvariantCulture)); break;
                case long x: b.Append(x.ToString(CultureInfo.InvariantCulture)); break;
                case IDictionary<string, object> d:
                    b.Append('{');
                    bool first = true;
                    foreach (var k in d.Keys.OrderBy(k => k, StringComparer.Ordinal))
                    {
                        if (!first) b.Append(',');
                        first = false;
                        Quote(b, k);
                        b.Append(':');
                        Write(b, d[k]);
                    }
                    b.Append('}');
                    break;
                case System.Collections.IEnumerable l:
                    b.Append('[');
                    bool f2 = true;
                    foreach (var x in l) { if (!f2) b.Append(','); f2 = false; Write(b, x); }
                    b.Append(']');
                    break;
                default: Quote(b, v.ToString()); break;
            }
        }

        static string Num(double x)
        {
            if (double.IsNaN(x) || double.IsInfinity(x)) return "null";
            if (x == Math.Floor(x) && Math.Abs(x) < 1e15) return ((long)x).ToString(CultureInfo.InvariantCulture);
            return x.ToString("R", CultureInfo.InvariantCulture);
        }

        static void Quote(StringBuilder b, string s)
        {
            b.Append('"');
            foreach (char c in s)
            {
                if (c == '"') b.Append("\\\"");
                else if (c == '\\') b.Append("\\\\");
                else if (c == '\n') b.Append("\\n");
                else if (c == '\r') b.Append("\\r");
                else if (c == '\t') b.Append("\\t");
                else if (c < 0x20) b.Append("\\u").Append(((int)c).ToString("x4"));
                else b.Append(c);
            }
            b.Append('"');
        }

        // ---- reading a parsed value ----
        public static Dictionary<string, object> Obj(object o, string k) => (o as Dictionary<string, object>) != null && ((Dictionary<string, object>)o).TryGetValue(k, out var v) ? v as Dictionary<string, object> : null;
        public static List<object> Arr(object o, string k) => (o as Dictionary<string, object>) != null && ((Dictionary<string, object>)o).TryGetValue(k, out var v) ? v as List<object> : null;
        public static string Str(object o, string k, string d = null) => (o as Dictionary<string, object>) != null && ((Dictionary<string, object>)o).TryGetValue(k, out var v) && v is string s ? s : d;
        public static double Num(object o, string k, double d = 0) => (o as Dictionary<string, object>) != null && ((Dictionary<string, object>)o).TryGetValue(k, out var v) && v is double x ? x : d;
        public static bool Has(object o, string k) => (o as Dictionary<string, object>) != null && ((Dictionary<string, object>)o).ContainsKey(k) && ((Dictionary<string, object>)o)[k] != null;
        public static bool Truthy(object o, string k) => (o as Dictionary<string, object>) != null && ((Dictionary<string, object>)o).TryGetValue(k, out var v) && v != null && !(v is bool b && !b) && !(v is double x && x == 0);
        public static float[] Floats(object o, string k)
        {
            var l = Arr(o, k);
            if (l == null) return null;
            return l.Select(x => x is double d ? (float)d : 0f).ToArray();
        }
        public static float[] Floats(object l) => (l as List<object>)?.Select(x => x is double d ? (float)d : 0f).ToArray();
    }
}
