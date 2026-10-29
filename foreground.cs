// Read foreground state only; never activate or flash a window.
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

public static class DshLiteForeground
{
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int count);

    public static bool MatchesTitle(string title)
    {
        return Regex.IsMatch(title, @"(?:^| — | - )(?:DeepSeek Harness|DSH Local Build|DSH 本地构建)(?:$| - | 和另外 )");
    }

    public static bool IsFocused()
    {
        IntPtr window = GetForegroundWindow();
        if (window == IntPtr.Zero || IsIconic(window)) return false;
        StringBuilder title = new StringBuilder(2048);
        GetWindowText(window, title, title.Capacity);
        return MatchesTitle(title.ToString());
    }
}
