using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;

[assembly: AssemblyTitle("DeepSeek Harness Notifications")]
[assembly: AssemblyProduct("DeepSeek Harness")]

// Fixed local entry point for the notification protocol; accepts no commands or target URLs.
internal static class NotificationLauncher
{
    [STAThread]
    private static int Main(string[] args)
    {
        string directory = AppDomain.CurrentDomain.BaseDirectory;
        try
        {
            if (args.Length != 1 || !Regex.IsMatch(args[0], @"\Adsh-local-notification://open/?\?token=[A-Za-z0-9_-]{43}\z"))
                throw new ArgumentException("Invalid notification activation");
            File.WriteAllText(Path.Combine(directory, "activation-launcher.log"), DateTime.UtcNow.ToString("O") + " started\n");
            var start = new ProcessStartInfo
            {
                FileName = Path.Combine(directory, ".venv", "Scripts", "python.exe"),
                Arguments = "\"" + Path.Combine(directory, "activate.py") + "\" \"" + args[0] + "\"",
                WorkingDirectory = directory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            using (var child = Process.Start(start))
            {
                var output = child.StandardOutput.ReadToEndAsync();
                var error = child.StandardError.ReadToEndAsync();
                if (!child.WaitForExit(45000))
                {
                    child.Kill();
                    throw new TimeoutException("Notification activation timed out");
                }
                if (child.ExitCode != 0)
                    throw new InvalidOperationException("Local notification activation failed; see activation-errors.log");
            }
            File.AppendAllText(Path.Combine(directory, "activation-launcher.log"), DateTime.UtcNow.ToString("O") + " completed\n");
            return 0;
        }
        catch (Exception error)
        {
            File.AppendAllText(Path.Combine(directory, "activation-launcher.log"), DateTime.UtcNow.ToString("O") + " " + error.Message + "\n");
            return 1;
        }
    }
}
