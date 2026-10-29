// Desktop notification identity backed by a Start-menu shortcut and its AUMID.
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

public static class DshLiteIdentity
{
    public const string AppId = "DeepSeekHarness.Notifications.Lite";
    public const string DisplayName = "DeepSeek Harness";
    private static readonly PropertyKey IdKey = new PropertyKey(new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 5);

    public static string ShortcutPath
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "DSH Windows Notifications Lite", DisplayName + ".lnk"); }
    }

    // Refresh changed paths after a move; unchanged shortcuts are not rewritten.
    public static void Ensure(string directory)
    {
        string target = Path.Combine(directory, "notification-identity.exe");
        string icon = Path.Combine(directory, "sender-original.ico");
        if (!File.Exists(target) || !File.Exists(icon)) throw new FileNotFoundException("Restore notification-identity.exe and sender-original.ico from the plugin package.");
        object linkObject = new ShellLink();
        try
        {
            IShellLinkW link = (IShellLinkW)linkObject;
            IPropertyStore properties = (IPropertyStore)linkObject;
            IPersistFile file = (IPersistFile)linkObject;
            if (File.Exists(ShortcutPath))
            {
                file.Load(ShortcutPath, 0);
                StringBuilder oldTarget = new StringBuilder(32768);
                StringBuilder oldIcon = new StringBuilder(32768);
                int iconIndex;
                link.GetPath(oldTarget, oldTarget.Capacity, IntPtr.Zero, 0);
                link.GetIconLocation(oldIcon, oldIcon.Capacity, out iconIndex);
                PropertyKey key = IdKey;
                PropVariant value;
                properties.GetValue(ref key, out value);
                try
                {
                    if (value.Type == 31 && Marshal.PtrToStringUni(value.Pointer) == AppId
                        && String.Equals(oldTarget.ToString(), target, StringComparison.OrdinalIgnoreCase)
                        && String.Equals(oldIcon.ToString(), icon, StringComparison.OrdinalIgnoreCase) && iconIndex == 0) return;
                }
                finally { PropVariantClear(ref value); }
            }
            link.SetPath(target);
            link.SetDescription(DisplayName);
            link.SetWorkingDirectory(directory);
            link.SetArguments("");
            link.SetIconLocation(icon, 0);
            PropertyKey id = IdKey;
            PropVariant appId = new PropVariant { Type = 31, Pointer = Marshal.StringToCoTaskMemUni(AppId) };
            try { properties.SetValue(ref id, ref appId); properties.Commit(); }
            finally { PropVariantClear(ref appId); }
            Directory.CreateDirectory(Path.GetDirectoryName(ShortcutPath));
            file.Save(ShortcutPath, true);
            SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
        }
        finally { Marshal.FinalReleaseComObject(linkObject); }
    }

    // Read back the persisted shortcut rather than trusting a write alone.
    public static string ReadAppId()
    {
        object linkObject = new ShellLink();
        try
        {
            ((IPersistFile)linkObject).Load(ShortcutPath, 0);
            PropertyKey key = IdKey;
            PropVariant value;
            ((IPropertyStore)linkObject).GetValue(ref key, out value);
            try { return value.Type == 31 ? Marshal.PtrToStringUni(value.Pointer) : null; }
            finally { PropVariantClear(ref value); }
        }
        finally { Marshal.FinalReleaseComObject(linkObject); }
    }

    [DllImport("ole32.dll")] private static extern int PropVariantClear(ref PropVariant value);
    [DllImport("shell32.dll")] private static extern void SHChangeNotify(uint change, uint flags, IntPtr item1, IntPtr item2);
    [StructLayout(LayoutKind.Sequential)] private struct PropertyKey
    {
        public Guid Format;
        public uint Id;
        public PropertyKey(Guid format, uint id) { Format = format; Id = id; }
    }
    [StructLayout(LayoutKind.Explicit, Size = 24)] private struct PropVariant
    {
        [FieldOffset(0)] public ushort Type;
        [FieldOffset(8)] public IntPtr Pointer;
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        void GetCount(out uint count);
        void GetAt(uint index, out PropertyKey key);
        void GetValue(ref PropertyKey key, out PropVariant value);
        void SetValue(ref PropertyKey key, ref PropVariant value);
        void Commit();
    }
    [ComImport, Guid("00021401-0000-0000-C000-000000000046"), ClassInterface(ClassInterfaceType.None)]
    private class ShellLink { }
    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int length, IntPtr data, uint flags);
        void GetIDList(out IntPtr list);
        void SetIDList(IntPtr list);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int length);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string value);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int length);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string value);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int length);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string value);
        void GetHotkey(out short value);
        void SetHotkey(short value);
        void GetShowCmd(out int value);
        void SetShowCmd(int value);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int length, out int index);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr window, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }
}
