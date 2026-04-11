using System.ComponentModel.DataAnnotations;

namespace HomeLabInfo.Api.Models;

public class AppSetting
{
    [Key]
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
