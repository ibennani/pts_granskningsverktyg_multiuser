/**
 * Registrerar vykomponenter (singletons) och mappar vy-namn till rätt instans.
 * Används av view_render.js — samma instanser som tidigare i main.js.
 */
import { EditMetadataViewComponent } from '../components/EditMetadataViewComponent.js';
import { SampleManagementViewComponent } from '../components/SampleManagementViewComponent.js';
import { SampleFormViewComponent } from '../components/SampleFormViewComponent.js';
import { ConfirmSampleEditViewComponent } from '../components/ConfirmSampleEditViewComponent.js';
import { AuditOverviewComponent } from '../components/AuditOverviewComponent.js';
import { RequirementListComponent } from '../components/RequirementListComponent.js';
import { RequirementAuditComponent } from '../components/RequirementAuditComponent.js';
import { UpdateRulefileViewComponent } from '../components/UpdateRulefileViewComponent.js';
import { ConfirmUpdatesViewComponent } from '../components/ConfirmUpdatesViewComponent.js';
import { FinalConfirmUpdatesViewComponent } from '../components/FinalConfirmUpdatesViewComponent.js';
import { EditRulefileMainViewComponent } from '../components/EditRulefileMainViewComponent.js';
import { RulefileRequirementsListComponent } from '../components/RulefileRequirementsListComponent.js';
import { ViewRulefileRequirementComponent } from '../components/ViewRulefileRequirementComponent.js';
import { EditRulefileRequirementComponent } from '../components/rulefile_editor/EditRulefileRequirementComponent.js';
import { ConfirmDeleteViewComponent } from '../components/ConfirmDeleteViewComponent.js';
import { EditRulefileMetadataViewComponent } from '../components/EditRulefileMetadataViewComponent.js';
import { RulefileMetadataViewComponent } from '../components/RulefileMetadataViewComponent.js';
import { EditGeneralSectionComponent } from '../components/EditGeneralSectionComponent.js';
import { EditPageTypesSectionComponent } from '../components/EditPageTypesSectionComponent.js';
import { RulefileSectionsViewComponent } from '../components/RulefileSectionsViewComponent.js';
import { AuditActionsViewComponent } from '../components/AuditActionsViewComponent.js';
import { AllRequirementsViewComponent } from '../components/AllRequirementsViewComponent.js';
import { AuditProblemsViewComponent } from '../components/AuditProblemsViewComponent.js';
import { ArchivedRequirementsViewComponent } from '../components/ArchivedRequirementsViewComponent.js';
import { RulefileChangeLogViewComponent } from '../components/RulefileChangeLogViewComponent.js';
import { AuditImagesViewComponent } from '../components/AuditImagesViewComponent.js';
import { BackupOverviewComponent } from '../components/BackupOverviewComponent.js';
import { BackupSettingsViewComponent } from '../components/BackupSettingsViewComponent.js';
import { AuditViewComponent } from '../components/audit_view/AuditViewComponent.js';
import { LoginViewComponent } from '../components/LoginViewComponent.js';
import { ManageUsersViewComponent } from '../components/ManageUsersViewComponent.js';
import { SettingsViewComponent } from '../components/SettingsViewComponent.js';
import { StatisticsViewComponent } from '../components/StatisticsViewComponent.js';

const auditViewComponent = new AuditViewComponent();
const allRequirementsViewComponent = new AllRequirementsViewComponent();
const loginViewComponent = new LoginViewComponent();
const auditOverviewComponent = new AuditOverviewComponent();
const confirmSampleEditViewComponent = new ConfirmSampleEditViewComponent();
const finalConfirmUpdatesViewComponent = new FinalConfirmUpdatesViewComponent();
const archivedRequirementsViewComponent = new ArchivedRequirementsViewComponent();
const auditActionsViewComponent = new AuditActionsViewComponent();
const auditImagesViewComponent = new AuditImagesViewComponent();
const auditProblemsViewComponent = new AuditProblemsViewComponent();
const sampleManagementViewComponent = new SampleManagementViewComponent();
const sampleFormViewComponent = new SampleFormViewComponent();
const editMetadataViewComponent = new EditMetadataViewComponent();
const requirementListComponent = new RequirementListComponent();
const requirementAuditComponent = new RequirementAuditComponent();
const confirmUpdatesViewComponent = new ConfirmUpdatesViewComponent();
const updateRulefileViewComponent = new UpdateRulefileViewComponent();
const backupOverviewComponent = new BackupOverviewComponent();
const backupSettingsViewComponent = new BackupSettingsViewComponent();
const manageUsersViewComponent = new ManageUsersViewComponent();
const settingsViewComponent = new SettingsViewComponent();
const statisticsViewComponent = new StatisticsViewComponent();
const rulefileChangeLogViewComponent = new RulefileChangeLogViewComponent();
const rulefileRequirementsListComponent = new RulefileRequirementsListComponent();
const viewRulefileRequirementComponent = new ViewRulefileRequirementComponent();
const editRulefileMainViewComponent = new EditRulefileMainViewComponent();
const editRulefileMetadataViewComponent = new EditRulefileMetadataViewComponent();
const rulefileMetadataViewComponent = new RulefileMetadataViewComponent();
const rulefileSectionsViewComponent = new RulefileSectionsViewComponent();
const editGeneralSectionComponent = new EditGeneralSectionComponent();
const editPageTypesSectionComponent = new EditPageTypesSectionComponent();
const confirmDeleteViewComponent = new ConfirmDeleteViewComponent();
const editRulefileRequirementComponent = new EditRulefileRequirementComponent();

/**
 * Returnerar komponentinstans för vy-namn (samma mappning som tidigare i main.js switch).
 * @param {string} view_name
 * @returns {object|null}
 */
export function get_component_class(view_name) {
    switch (view_name) {
        case 'start': return auditViewComponent;
        case 'audit': return auditViewComponent;
        case 'audit_audits': return auditViewComponent;
        case 'audit_rules': return auditViewComponent;
        case 'manage_users': return manageUsersViewComponent;
        case 'my_settings': return settingsViewComponent;
        case 'statistics': return statisticsViewComponent;
        case 'login': return loginViewComponent;
        case 'metadata': return editMetadataViewComponent;
        case 'edit_metadata': return editMetadataViewComponent;
        case 'sample_management': return sampleManagementViewComponent;
        case 'sample_form': return sampleFormViewComponent;
        case 'confirm_sample_edit': return confirmSampleEditViewComponent;
        case 'audit_overview': return auditOverviewComponent;
        case 'audit_actions': return auditActionsViewComponent;
        case 'all_requirements': return allRequirementsViewComponent;
        case 'audit_problems': return auditProblemsViewComponent;
        case 'audit_images': return auditImagesViewComponent;
        case 'archived_requirements': return archivedRequirementsViewComponent;
        case 'rulefile_change_log': return rulefileChangeLogViewComponent;
        case 'requirement_list': return requirementListComponent;
        case 'requirement_audit': return requirementAuditComponent;
        case 'update_rulefile': return updateRulefileViewComponent;
        case 'confirm_updates': return confirmUpdatesViewComponent;
        case 'final_confirm_updates': return finalConfirmUpdatesViewComponent;
        case 'edit_rulefile_main': return editRulefileMainViewComponent;
        case 'rulefile_requirements': return rulefileRequirementsListComponent;
        case 'rulefile_view_requirement': return viewRulefileRequirementComponent;
        case 'rulefile_edit_requirement': return editRulefileRequirementComponent;
        case 'rulefile_add_requirement': return editRulefileRequirementComponent;
        case 'rulefile_metadata_edit': return editRulefileMetadataViewComponent;
        case 'rulefile_metadata_view': return rulefileMetadataViewComponent;
        case 'rulefile_sections_edit_general': return editGeneralSectionComponent;
        case 'rulefile_sections_edit_page_types': return editPageTypesSectionComponent;
        case 'rulefile_sections': return rulefileSectionsViewComponent;
        case 'backup': return backupOverviewComponent;
        case 'backup_detail': return backupOverviewComponent;
        case 'backup_settings': return backupSettingsViewComponent;
        case 'confirm_delete': return confirmDeleteViewComponent;
        default:
            return null;
    }
}

export {
    rulefileSectionsViewComponent,
    requirementListComponent
};
