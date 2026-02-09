output "zone_id" {
  description = "The ID of the Route53 hosted zone"
  value       = data.aws_route53_zone.selected.zone_id
}

output "zone_name" {
  description = "The name of the Route53 hosted zone"
  value       = data.aws_route53_zone.selected.name
}

output "apex_record_name" {
  description = "The name of the apex DNS record"
  value       = var.create_apex_record ? aws_route53_record.apex[0].name : null
}

output "www_record_name" {
  description = "The name of the www DNS record"
  value       = var.create_www_record ? aws_route53_record.www[0].name : null
}

output "custom_record_names" {
  description = "The names of custom DNS records"
  value       = { for k, v in aws_route53_record.custom : k => v.name }
}

output "health_check_id" {
  description = "The ID of the Route53 health check"
  value       = var.create_health_check ? aws_route53_health_check.clipshare_health[0].id : null
}